import {
    requestAgentQuestionBodySchema,
    workItemInputSchema,
    workItemResultSchema,
    workItemSchema,
    type WorkItem,
} from "@quiz-builder/contracts";
import { AppError } from "../errors/app-error.ts";
import { createQuestionInTransaction, type QueryExecutor } from "../db/question-bank.ts";
import { submitQuestionReviewInTransaction } from "../db/content-workflow.ts";
import { withTransaction } from "../db/transaction.ts";
import {
    agentGenerationMetadataSchema,
    type AgentGeneration,
    type AgentProvider,
} from "./provider.ts";

export const QUESTION_AGENT_ID = "00000000-0000-4000-8000-00000000a001";

type CreationRow = {
    id: string;
    assigned_to: string;
    input: unknown;
    status: WorkItem["status"];
    attempts: number;
    claim_generation: number;
    claim_token: string | null;
    lease_until: string | Date | null;
    created_at: string | Date;
    claimed_agent_actor_id: string | null;
    question_id: string | null;
    question_version_id: string | null;
};

function publicItem(row: CreationRow): WorkItem {
    return workItemSchema.parse({
        id: row.id,
        queueName: "question-creation",
        itemType: "CREATE_QUESTION",
        questionId: row.question_id,
        questionVersionId: row.question_version_id,
        versionNumber: null,
        prompt: null,
        input: workItemInputSchema.parse(row.input),
        status: row.status,
        attempts: row.attempts,
        claimGeneration: row.claim_generation,
        claimToken: null,
        assignedAgentActorId: QUESTION_AGENT_ID,
        leaseUntil: row.lease_until ? new Date(row.lease_until).toISOString() : null,
        createdAt: new Date(row.created_at).toISOString(),
    });
}

async function machineEvent(
    database: QueryExecutor,
    itemId: string,
    type: string,
    generation: number,
    details: Record<string, unknown> = {},
) {
    await database.query(
        `INSERT INTO public.work_item_events
        (work_item_id, agent_actor_id, event_type, claim_generation, details)
        VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [itemId, QUESTION_AGENT_ID, type, generation, JSON.stringify(details)],
    );
}

export async function enqueueAgentQuestionInTransaction(
    sponsorId: string,
    request: { brief: string; requestKey: string },
    database: QueryExecutor,
): Promise<WorkItem> {
    const input = requestAgentQuestionBodySchema.parse(request);
    const sponsor = await database.query<{ id: string }>(
        `SELECT id FROM public.profiles WHERE id = $1 FOR UPDATE`,
        [sponsorId],
    );
    if (!sponsor.rows[0]) throw new AppError(404, "PROFILE_NOT_FOUND", "Profile not found");
    const key = `agent-create:${sponsorId}:${input.requestKey}`;
    const existing = await database.query<CreationRow>(
        `SELECT * FROM public.work_items WHERE operation_key = $1`,
        [key],
    );
    if (existing.rows[0]) {
        const oldInput = workItemInputSchema.parse(existing.rows[0].input);
        if (oldInput.type !== "CREATE_QUESTION" || oldInput.brief !== input.brief)
            throw new AppError(
                409,
                "IDEMPOTENCY_CONFLICT",
                "Request key was used with different content",
            );
        return publicItem(existing.rows[0]);
    }
    const backlog = await database.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM public.work_items
         WHERE assigned_to = $1 AND item_type = 'CREATE_QUESTION'
         AND status IN ('pending', 'claimed')`,
        [sponsorId],
    );
    if (backlog.rows[0].count >= 5)
        throw new AppError(
            429,
            "AGENT_QUEUE_LIMIT",
            "Finish existing agent requests before adding more",
        );
    const daily = await database.query<{ count: number }>(
        `SELECT count(*)::int AS count FROM public.work_items
         WHERE assigned_to = $1 AND item_type = 'CREATE_QUESTION'
         AND created_at > now() - interval '24 hours'`,
        [sponsorId],
    );
    if (daily.rows[0].count >= 20)
        throw new AppError(429, "AGENT_DAILY_LIMIT", "Daily agent request limit reached");
    const workInput = workItemInputSchema.parse({
        schemaVersion: 1,
        type: "CREATE_QUESTION",
        brief: input.brief,
    });
    const inserted = await database.query<CreationRow>(
        `INSERT INTO public.work_items
         (queue_name, item_type, assigned_to, assigned_agent_actor_id, input, operation_key)
         VALUES ('question-creation', 'CREATE_QUESTION', $1, $2, $3::jsonb, $4)
         RETURNING *`,
        [sponsorId, QUESTION_AGENT_ID, JSON.stringify(workInput), key],
    );
    const item = inserted.rows[0];
    await database.query(
        `INSERT INTO public.work_item_events
        (work_item_id, actor_id, event_type, claim_generation)
        VALUES ($1, $2, 'enqueued', 0)`,
        [item.id, sponsorId],
    );
    return publicItem(item);
}

export function enqueueAgentQuestion(
    sponsorId: string,
    request: { brief: string; requestKey: string },
) {
    return withTransaction((database) =>
        enqueueAgentQuestionInTransaction(sponsorId, request, database),
    );
}

export type AgentClaim = {
    id: string;
    token: string;
    generation: number;
    sponsorId: string;
    brief: string;
};

export async function claimAgentQuestionInTransaction(
    database: QueryExecutor,
): Promise<AgentClaim | null> {
    const exhausted = await database.query<CreationRow>(
        `UPDATE public.work_items SET status = 'failed', claim_token = NULL,
         claimed_agent_actor_id = NULL, lease_until = NULL, updated_at = now()
         WHERE item_type = 'CREATE_QUESTION' AND status = 'claimed'
         AND lease_until <= now() AND attempts >= 3 RETURNING *`,
    );
    for (const row of exhausted.rows)
        await machineEvent(database, row.id, "failed", row.claim_generation, {
            reason: "retry_exhausted",
        });
    const selected = await database.query<CreationRow>(
        `SELECT * FROM public.work_items WHERE item_type = 'CREATE_QUESTION'
         AND queue_name = 'question-creation' AND attempts < 3
         AND (status = 'pending' OR (status = 'claimed' AND lease_until <= now()))
         ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1`,
    );
    const item = selected.rows[0];
    if (!item) return null;
    const input = workItemInputSchema.parse(item.input);
    if (input.type !== "CREATE_QUESTION") throw new Error("Agent item input is invalid");
    const claimed = await database.query<CreationRow>(
        `UPDATE public.work_items SET status = 'claimed', claim_token = gen_random_uuid(),
         claim_generation = claim_generation + 1, attempts = attempts + 1,
         claimed_by = NULL, claimed_agent_actor_id = $2,
         lease_until = now() + interval '5 minutes', updated_at = now()
         WHERE id = $1 RETURNING *`,
        [item.id, QUESTION_AGENT_ID],
    );
    const current = claimed.rows[0];
    await machineEvent(database, item.id, "claimed", current.claim_generation);
    return {
        id: item.id,
        token: current.claim_token!,
        generation: current.claim_generation,
        sponsorId: item.assigned_to,
        brief: input.brief,
    };
}

export function claimAgentQuestion() {
    return withTransaction((database) => claimAgentQuestionInTransaction(database));
}

async function lockClaim(claim: AgentClaim, database: QueryExecutor): Promise<CreationRow> {
    const item = await database.query<CreationRow>(
        `SELECT * FROM public.work_items WHERE id = $1 AND item_type = 'CREATE_QUESTION'
         FOR UPDATE`,
        [claim.id],
    );
    const row = item.rows[0];
    if (
        !row ||
        row.status !== "claimed" ||
        row.claim_token !== claim.token ||
        row.claim_generation !== claim.generation ||
        row.assigned_to !== claim.sponsorId ||
        row.claimed_agent_actor_id !== QUESTION_AGENT_ID ||
        !row.lease_until ||
        new Date(row.lease_until) <= new Date()
    )
        throw new AppError(
            409,
            "STALE_WORK_ITEM_CLAIM",
            "Agent claim has expired or been replaced",
        );
    return row;
}

export async function completeAgentQuestionInTransaction(
    claim: AgentClaim,
    generation: AgentGeneration,
    provider: { name: string; model: string },
    database: QueryExecutor,
): Promise<{ questionId: string; versionId: string; reviewItemId: string }> {
    await lockClaim(claim, database);
    const run = await database.query<{ id: string }>(
        `INSERT INTO public.agent_generation_runs
         (agent_actor_id, sponsor_id, work_item_id, provider, model, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING id`,
        [
            QUESTION_AGENT_ID,
            claim.sponsorId,
            claim.id,
            provider.name,
            provider.model,
            JSON.stringify(agentGenerationMetadataSchema.parse(generation.metadata)),
        ],
    );
    const question = await createQuestionInTransaction(
        claim.sponsorId,
        { content: generation.content, visibility: "private" },
        database,
        run.rows[0].id,
    );
    const review = await submitQuestionReviewInTransaction(
        question.id,
        question.currentVersion.id,
        claim.sponsorId,
        database,
    );
    const result = workItemResultSchema.parse({
        schemaVersion: 1,
        type: "CREATE_QUESTION",
        questionId: question.id,
        versionId: question.currentVersion.id,
        agentRunId: run.rows[0].id,
    });
    await database.query(
        `UPDATE public.work_items SET status = 'completed', question_id = $2,
        question_version_id = $3, updated_at = now() WHERE id = $1`,
        [claim.id, question.id, question.currentVersion.id],
    );
    await machineEvent(database, claim.id, "completed", claim.generation, { result });
    return {
        questionId: question.id,
        versionId: question.currentVersion.id,
        reviewItemId: review.id,
    };
}

export function completeAgentQuestion(
    claim: AgentClaim,
    generation: AgentGeneration,
    provider: { name: string; model: string },
) {
    return withTransaction((database) =>
        completeAgentQuestionInTransaction(claim, generation, provider, database),
    );
}

export async function failAgentQuestionInTransaction(
    claim: AgentClaim,
    reason: string,
    database: QueryExecutor,
) {
    const row = await lockClaim(claim, database);
    const failed = row.attempts >= 3;
    await database.query(
        `UPDATE public.work_items SET status = $2, claim_token = NULL,
        claimed_agent_actor_id = NULL, lease_until = NULL, updated_at = now() WHERE id = $1`,
        [claim.id, failed ? "failed" : "pending"],
    );
    await machineEvent(database, claim.id, failed ? "failed" : "retry", claim.generation, {
        reason: reason.slice(0, 200),
    });
}

export function failAgentQuestion(claim: AgentClaim, reason: string) {
    return withTransaction((database) => failAgentQuestionInTransaction(claim, reason, database));
}

export async function processOneAgentQuestion(
    provider: AgentProvider,
    provenance: { name: string; model: string },
): Promise<boolean> {
    const claim = await claimAgentQuestion();
    if (!claim) return false;
    try {
        const generation = await provider(claim.brief);
        await completeAgentQuestion(claim, generation, provenance);
    } catch (error) {
        if (error instanceof AppError && error.code === "STALE_WORK_ITEM_CLAIM") return true;
        await failAgentQuestion(claim, error instanceof Error ? error.name : "unknown");
    }
    return true;
}
