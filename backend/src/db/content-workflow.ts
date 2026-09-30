import {
    workItemInputSchema,
    workItemResultSchema,
    workItemListResponseSchema,
    workItemSchema,
    type WorkItem,
} from "@quiz-builder/contracts";
import { AppError } from "../errors/app-error.ts";
import { pool } from "./index.ts";
import { withTransaction } from "./transaction.ts";
import type { QueryExecutor } from "./question-bank.ts";

export const REVIEW_AGENT_ID = "00000000-0000-4000-8000-00000000a002";
export const REVISION_AGENT_ID = "00000000-0000-4000-8000-00000000a003";
export const GATE_AGENT_ID = "00000000-0000-4000-8000-00000000a004";

export type WorkflowPolicy = {
    version: number;
    mode: string;
    source: string;
    agentOriginRunId?: string;
    reviewerId: string;
    gateActorId: string;
    reviewerAgentId: string | null;
    revisionAgentId: string | null;
    gateAgentId: string | null;
    selfReviewAllowed: boolean;
    directPublish: boolean;
};

type ItemRow = {
    id: string;
    queue_name: WorkItem["queueName"];
    item_type: WorkItem["itemType"];
    question_id: string | null;
    question_version_id: string | null;
    version_number: number | null;
    prompt: string | null;
    input: unknown;
    status: WorkItem["status"];
    attempts: number;
    claim_generation: number;
    claim_token: string | null;
    lease_until: string | Date | null;
    created_at: string | Date;
    assigned_to: string;
    assigned_agent_actor_id: string | null;
    claimed_agent_actor_id: string | null;
    submission_id: string | null;
    operation_key: string;
};

const itemSelect = `SELECT wi.*, v.version_number, v.prompt
    FROM public.work_items wi
    LEFT JOIN public.question_versions v ON v.id = wi.question_version_id`;

function mapItem(row: ItemRow): WorkItem {
    const input = workItemInputSchema.parse(row.input);
    if (input.type !== row.item_type) throw new Error("Work item input type mismatch");
    return workItemSchema.parse({
        id: row.id,
        queueName: row.queue_name,
        itemType: row.item_type,
        questionId: row.question_id,
        questionVersionId: row.question_version_id,
        versionNumber: row.version_number,
        prompt: row.prompt,
        input,
        status: row.status,
        attempts: row.attempts,
        claimGeneration: row.claim_generation,
        claimToken: row.assigned_agent_actor_id ? null : row.claim_token,
        assignedAgentActorId: row.assigned_agent_actor_id,
        leaseUntil: row.lease_until ? new Date(row.lease_until).toISOString() : null,
        createdAt: new Date(row.created_at).toISOString(),
    });
}

async function getItem(id: string, actorId: string, database: QueryExecutor, lock = false) {
    const rows = await database.query<ItemRow>(
        `${itemSelect} WHERE wi.id = $1 AND wi.assigned_to = $2 ${lock ? "FOR UPDATE OF wi" : ""}`,
        [id, actorId],
    );
    if (!rows.rows[0]) throw new AppError(404, "WORK_ITEM_NOT_FOUND", "Work item not found");
    return rows.rows[0];
}

async function event(
    database: QueryExecutor,
    itemId: string,
    actorId: string | null,
    type: string,
    generation: number,
    details: Record<string, unknown> = {},
    agentActorId: string | null = null,
) {
    await database.query(
        `INSERT INTO public.work_item_events
         (work_item_id, actor_id, agent_actor_id, event_type, claim_generation, details)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
            itemId,
            agentActorId ? null : actorId,
            agentActorId,
            type,
            generation,
            JSON.stringify(details),
        ],
    );
}

async function enqueue(
    database: QueryExecutor,
    values: {
        queue: WorkItem["queueName"];
        type: WorkItem["itemType"];
        questionId: string;
        versionId: string;
        submissionId: string;
        assignee: string;
        agentActorId?: string | null;
        input: unknown;
        key: string;
    },
): Promise<string> {
    const input = workItemInputSchema.parse(values.input);
    if (input.type !== values.type) throw new Error("Work item type mismatch");
    const inserted = await database.query<{ id: string }>(
        `INSERT INTO public.work_items
         (queue_name, item_type, question_id, question_version_id, submission_id,
          assigned_to, assigned_agent_actor_id, input, operation_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
         ON CONFLICT (operation_key) DO NOTHING RETURNING id`,
        [
            values.queue,
            values.type,
            values.questionId,
            values.versionId,
            values.submissionId,
            values.assignee,
            values.agentActorId ?? null,
            JSON.stringify(input),
            values.key,
        ],
    );
    let id = inserted.rows[0]?.id;
    if (id) await event(database, id, values.assignee, "enqueued", 0);
    else {
        const existing = await database.query<{ id: string }>(
            `SELECT id FROM public.work_items WHERE operation_key = $1`,
            [values.key],
        );
        id = existing.rows[0]?.id;
    }
    if (!id) throw new Error("Work item enqueue returned no row");
    return id;
}

export async function submitQuestionReviewInTransaction(
    questionId: string,
    versionId: string,
    actorId: string,
    database: QueryExecutor,
    policyOverride?: WorkflowPolicy,
): Promise<WorkItem> {
    const question = await database.query<{
        current_version_id: string;
        status: string;
        agent_origin_run_id: string | null;
    }>(
        `SELECT current_version_id, status, agent_origin_run_id FROM public.questions
         WHERE id = $1 AND created_by = $2 FOR UPDATE`,
        [questionId, actorId],
    );
    if (!question.rows[0]) throw new AppError(404, "QUESTION_NOT_FOUND", "Question not found");
    if (question.rows[0].status === "archived")
        throw new AppError(409, "QUESTION_ARCHIVED", "Restore the question before review");
    if (question.rows[0].current_version_id !== versionId)
        throw new AppError(409, "STALE_QUESTION_VERSION", "Submit the current candidate version");
    const existing = await database.query<{ id: string }>(
        `SELECT id FROM public.question_review_submissions WHERE question_version_id = $1`,
        [versionId],
    );
    if (existing.rows[0]) {
        const item = await database.query<ItemRow>(
            `${itemSelect} WHERE wi.submission_id = $1 AND wi.item_type = 'REVIEW_QUESTION'`,
            [existing.rows[0].id],
        );
        if (!item.rows[0]) throw new Error("Review submission has no work item");
        return mapItem(item.rows[0]);
    }
    const policy: WorkflowPolicy = policyOverride ?? {
        version: 2,
        mode: "configured_review",
        source: question.rows[0].agent_origin_run_id ? "agent" : "human",
        ...(question.rows[0].agent_origin_run_id
            ? { agentOriginRunId: question.rows[0].agent_origin_run_id }
            : {}),
        reviewerId: actorId,
        gateActorId: actorId,
        reviewerAgentId: process.env.CONTENT_AGENT_REVIEW === "true" ? REVIEW_AGENT_ID : null,
        revisionAgentId: process.env.CONTENT_AGENT_REVISION === "true" ? REVISION_AGENT_ID : null,
        gateAgentId: process.env.CONTENT_AGENT_GATE === "true" ? GATE_AGENT_ID : null,
        selfReviewAllowed: true,
        directPublish: false,
    };
    if (policy.reviewerAgentId) {
        const source = await database.query<{ agent_actor_id: string | null }>(
            `SELECT r.agent_actor_id FROM public.question_versions v
             LEFT JOIN public.agent_generation_runs r ON r.id = v.agent_run_id
             WHERE v.id = $1`,
            [versionId],
        );
        if (source.rows[0]?.agent_actor_id === policy.reviewerAgentId)
            policy.reviewerAgentId = null;
    }
    policy.selfReviewAllowed = !policy.reviewerAgentId;
    const created = await database.query<{ id: string }>(
        `INSERT INTO public.question_review_submissions
         (question_id, question_version_id, submitted_by, policy_snapshot)
         VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
        [questionId, versionId, actorId, JSON.stringify(policy)],
    );
    const submissionId = created.rows[0].id;
    const id = await enqueue(database, {
        queue: "question-review",
        type: "REVIEW_QUESTION",
        questionId,
        versionId,
        submissionId,
        assignee: actorId,
        agentActorId: policy.reviewerAgentId,
        input: { schemaVersion: 1, type: "REVIEW_QUESTION", versionId },
        key: `review:${submissionId}`,
    });
    return mapItem(await getItem(id, actorId, database));
}

export function submitQuestionReview(questionId: string, versionId: string, actorId: string) {
    return withTransaction((db) =>
        submitQuestionReviewInTransaction(questionId, versionId, actorId, db),
    );
}

export async function listWorkItems(actorId: string, database: QueryExecutor = pool) {
    const result = await database.query<ItemRow>(
        `${itemSelect} WHERE wi.assigned_to = $1 ORDER BY wi.created_at DESC, wi.id DESC LIMIT 100`,
        [actorId],
    );
    return workItemListResponseSchema.parse({ items: result.rows.map(mapItem) });
}

export async function claimWorkItemInTransaction(
    id: string,
    actorId: string,
    database: QueryExecutor,
) {
    const item = await getItem(id, actorId, database, true);
    if (item.assigned_agent_actor_id)
        throw new AppError(
            403,
            "WORK_ITEM_MACHINE_ONLY",
            "This item is executed by an agent worker",
        );
    if (
        item.status !== "pending" &&
        !(item.status === "claimed" && item.lease_until && new Date(item.lease_until) <= new Date())
    ) {
        throw new AppError(409, "WORK_ITEM_NOT_CLAIMABLE", "Work item is not available to claim");
    }
    if (item.attempts >= 3) {
        await database.query(
            `UPDATE public.work_items SET status = 'failed', updated_at = now() WHERE id = $1`,
            [id],
        );
        await event(database, id, actorId, "failed", item.claim_generation, {
            reason: "retry_exhausted",
        });
        return mapItem(await getItem(id, actorId, database));
    }
    const updated = await database.query<{ claim_generation: number }>(
        `UPDATE public.work_items SET status = 'claimed', claim_token = gen_random_uuid(),
         claim_generation = claim_generation + 1, claimed_by = $2,
         lease_until = now() + interval '5 minutes', attempts = attempts + 1,
         updated_at = now() WHERE id = $1 RETURNING claim_generation`,
        [id, actorId],
    );
    await event(database, id, actorId, "claimed", updated.rows[0].claim_generation);
    return mapItem(await getItem(id, actorId, database));
}

export function claimWorkItem(id: string, actorId: string) {
    return withTransaction((db) => claimWorkItemInTransaction(id, actorId, db));
}

function validateClaim(item: ItemRow, token: string) {
    if (
        item.status !== "claimed" ||
        item.claim_token !== token ||
        !item.lease_until ||
        new Date(item.lease_until) <= new Date()
    ) {
        throw new AppError(409, "STALE_WORK_ITEM_CLAIM", "Claim has expired or been replaced");
    }
}

export async function decideWorkItemInTransaction(
    id: string,
    actorId: string,
    token: string,
    decision: "approved" | "approve_and_publish" | "changes_requested" | "rejected",
    findings: string,
    database: QueryExecutor,
    agent?: { id: string; executionRunId: string },
): Promise<WorkItem> {
    // Lock the question first, matching candidate creation and submission.
    const initial = await getItem(id, actorId, database);
    if (!initial.question_id || !initial.question_version_id || !initial.submission_id)
        throw new AppError(
            409,
            "WORK_ITEM_NOT_DECIDABLE",
            "This work item has no review submission",
        );
    const questions = await database.query<{ current_version_id: string; status: string }>(
        `SELECT current_version_id, status FROM public.questions WHERE id = $1 FOR UPDATE`,
        [initial.question_id],
    );
    const question = questions.rows[0];
    const item = await getItem(id, actorId, database, true);
    if (agent) {
        if (item.assigned_agent_actor_id !== agent.id || item.claimed_agent_actor_id !== agent.id)
            throw new AppError(403, "WORK_ITEM_WRONG_AGENT", "Agent is not assigned to this item");
    } else if (item.assigned_agent_actor_id)
        throw new AppError(403, "WORK_ITEM_MACHINE_ONLY", "This item is assigned to an agent");
    if (!item.question_id || !item.question_version_id || !item.submission_id)
        throw new AppError(
            409,
            "WORK_ITEM_NOT_DECIDABLE",
            "This work item has no review submission",
        );
    if (item.status === "completed" && item.claim_token === token) {
        const table =
            item.item_type === "REVIEW_QUESTION"
                ? "question_review_decisions"
                : "question_publication_gate_decisions";
        const recorded = await database.query<{ decision: string; findings: string }>(
            `SELECT decision, findings FROM public.${table} WHERE work_item_id = $1`,
            [id],
        );
        if (recorded.rows[0]?.decision === decision && recorded.rows[0]?.findings === findings)
            return mapItem(item);
        throw new AppError(409, "DECISION_ALREADY_RECORDED", "This item has a different decision");
    }
    validateClaim(item, token);
    if (item.item_type !== "REVIEW_QUESTION" && item.item_type !== "APPROVE_PUBLICATION")
        throw new AppError(409, "WORK_ITEM_NOT_DECIDABLE", "This item does not accept a decision");
    if (
        (item.item_type === "REVIEW_QUESTION" && decision === "approve_and_publish") ||
        (item.item_type === "APPROVE_PUBLICATION" && decision === "approved")
    )
        throw new AppError(400, "INVALID_DECISION", "Decision does not match the work item type");
    if (decision !== "approved" && decision !== "approve_and_publish" && !findings.trim())
        throw new AppError(400, "FINDINGS_REQUIRED", "Findings are required for this decision");
    const result = workItemResultSchema.parse({
        schemaVersion: 1,
        type: item.item_type,
        decision,
        findings,
    });
    if (
        !question ||
        question.status === "archived" ||
        question.current_version_id !== item.question_version_id
    )
        throw new AppError(409, "STALE_QUESTION_VERSION", "The candidate is no longer current");
    const policyRow = await database.query<{ policy_snapshot: WorkflowPolicy }>(
        `SELECT policy_snapshot FROM public.question_review_submissions WHERE id = $1`,
        [item.submission_id],
    );
    const policyForItem = policyRow.rows[0]?.policy_snapshot;
    if (!policyForItem) throw new Error("Review policy is missing");
    if (
        agent &&
        agent.id !==
            (item.item_type === "REVIEW_QUESTION"
                ? policyForItem.reviewerAgentId
                : policyForItem.gateAgentId)
    )
        throw new AppError(403, "WORK_ITEM_WRONG_AGENT", "Agent does not match review policy");
    if (agent && item.item_type === "REVIEW_QUESTION") {
        const source = await database.query<{ agent_actor_id: string | null }>(
            `SELECT r.agent_actor_id FROM public.question_versions v
             LEFT JOIN public.agent_generation_runs r ON r.id = v.agent_run_id
             WHERE v.id = $1`,
            [item.question_version_id],
        );
        if (source.rows[0]?.agent_actor_id === agent.id)
            throw new AppError(403, "AGENT_SELF_REVIEW", "Agent cannot review its own version");
    }
    if (
        agent &&
        item.item_type === "APPROVE_PUBLICATION" &&
        agent.id === policyForItem.reviewerAgentId
    )
        throw new AppError(
            403,
            "AGENT_GATE_NOT_INDEPENDENT",
            "Gate actor must differ from reviewer",
        );
    if (item.item_type === "REVIEW_QUESTION") {
        const review = await database.query<{ id: string }>(
            `INSERT INTO public.question_review_decisions
             (submission_id, work_item_id, actor_id, agent_actor_id, agent_execution_run_id, decision, findings)
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
            [
                item.submission_id,
                id,
                agent ? null : actorId,
                agent?.id ?? null,
                agent?.executionRunId ?? null,
                decision,
                findings,
            ],
        );
        if (decision === "approved") {
            await enqueue(database, {
                queue: "question-ready-to-publish",
                type: "APPROVE_PUBLICATION",
                questionId: item.question_id,
                versionId: item.question_version_id,
                submissionId: item.submission_id,
                assignee: actorId,
                agentActorId: policyForItem.gateAgentId,
                input: {
                    schemaVersion: 1,
                    type: "APPROVE_PUBLICATION",
                    versionId: item.question_version_id,
                    reviewDecisionId: review.rows[0].id,
                },
                key: `gate:${item.submission_id}`,
            });
        }
    } else {
        const review = await database.query<{ id: string; decision: string }>(
            `SELECT id, decision FROM public.question_review_decisions WHERE submission_id = $1`,
            [item.submission_id],
        );
        if (review.rows[0]?.decision !== "approved")
            throw new AppError(409, "REVIEW_NOT_APPROVED", "Content review is not approved");
        await database.query(
            `INSERT INTO public.question_publication_gate_decisions
             (submission_id, review_decision_id, work_item_id, actor_id, agent_actor_id,
              agent_execution_run_id, decision, findings, policy_snapshot)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
            [
                item.submission_id,
                review.rows[0].id,
                id,
                agent ? null : actorId,
                agent?.id ?? null,
                agent?.executionRunId ?? null,
                decision,
                findings,
                JSON.stringify(policyForItem),
            ],
        );
        if (decision === "approve_and_publish") {
            await database.query(
                `INSERT INTO public.question_publication_events
                 (question_id, question_version_id, actor_id, agent_actor_id, event_type)
                 VALUES ($1, $2, $3, $4, 'published')`,
                [
                    item.question_id,
                    item.question_version_id,
                    agent ? null : actorId,
                    agent?.id ?? null,
                ],
            );
            await database.query(
                `UPDATE public.questions SET status = 'published',
                 default_published_version_id = $2, updated_at = now() WHERE id = $1`,
                [item.question_id, item.question_version_id],
            );
        }
    }
    if (decision === "changes_requested") {
        const cycles = await database.query<{ count: number }>(
            `SELECT count(*)::int AS count FROM public.question_review_submissions WHERE question_id = $1`,
            [item.question_id],
        );
        await enqueue(database, {
            queue: "question-revision",
            type: "REVISE_QUESTION",
            questionId: item.question_id,
            versionId: item.question_version_id,
            submissionId: item.submission_id,
            assignee: actorId,
            agentActorId: cycles.rows[0].count < 3 ? policyForItem.revisionAgentId : null,
            input: {
                schemaVersion: 1,
                type: "REVISE_QUESTION",
                sourceVersionId: item.question_version_id,
            },
            key: `revise:${item.submission_id}:${item.item_type}`,
        });
    }
    await database.query(
        `UPDATE public.work_items SET status = 'completed', updated_at = now() WHERE id = $1`,
        [id],
    );
    await event(database, id, actorId, "completed", item.claim_generation, { result }, agent?.id);
    return mapItem(await getItem(id, actorId, database));
}

export function decideWorkItem(
    id: string,
    actorId: string,
    token: string,
    decision: "approved" | "approve_and_publish" | "changes_requested" | "rejected",
    findings: string,
) {
    return withTransaction((db) =>
        decideWorkItemInTransaction(id, actorId, token, decision, findings, db),
    );
}

export async function failWorkItemInTransaction(
    id: string,
    actorId: string,
    token: string,
    reason: string,
    database: QueryExecutor,
) {
    const item = await getItem(id, actorId, database, true);
    if (item.assigned_agent_actor_id)
        throw new AppError(
            403,
            "WORK_ITEM_MACHINE_ONLY",
            "This item is executed by an agent worker",
        );
    validateClaim(item, token);
    const exhausted = item.attempts >= 3;
    await database.query(
        `UPDATE public.work_items SET status = $2, claim_token = NULL, claimed_by = NULL,
         lease_until = NULL, updated_at = now() WHERE id = $1`,
        [id, exhausted ? "failed" : "pending"],
    );
    await event(database, id, actorId, exhausted ? "failed" : "retry", item.claim_generation, {
        reason,
    });
    return mapItem(await getItem(id, actorId, database));
}

export function failWorkItem(id: string, actorId: string, token: string, reason: string) {
    return withTransaction((db) => failWorkItemInTransaction(id, actorId, token, reason, db));
}

export async function cancelWorkItemInTransaction(
    id: string,
    actorId: string,
    database: QueryExecutor,
) {
    const item = await getItem(id, actorId, database, true);
    if (item.status !== "pending" && item.status !== "claimed")
        throw new AppError(409, "WORK_ITEM_NOT_CANCELLABLE", "Work item is already closed");
    await database.query(
        `UPDATE public.work_items SET status = 'cancelled', claim_token = NULL,
        claimed_by = NULL, claimed_agent_actor_id = NULL,
        lease_until = NULL, updated_at = now() WHERE id = $1`,
        [id],
    );
    await event(database, id, actorId, "cancelled", item.claim_generation);
    return mapItem(await getItem(id, actorId, database));
}

export function cancelWorkItem(id: string, actorId: string) {
    return withTransaction((db) => cancelWorkItemInTransaction(id, actorId, db));
}

export async function handOffFailedAgentItemInTransaction(
    id: string,
    actorId: string,
    database: QueryExecutor,
) {
    const item = await getItem(id, actorId, database, true);
    if (
        !item.assigned_agent_actor_id ||
        item.item_type === "CREATE_QUESTION" ||
        item.status !== "failed"
    )
        throw new AppError(
            409,
            "WORK_ITEM_NOT_HANDOFFABLE",
            "Only failed agent workflow items can be handed to a human",
        );
    await database.query(
        `UPDATE public.work_items SET assigned_agent_actor_id = NULL, status = 'pending',
         attempts = 0, claim_token = NULL, claimed_agent_actor_id = NULL,
         claimed_by = NULL, lease_until = NULL, updated_at = now() WHERE id = $1`,
        [id],
    );
    await event(database, id, actorId, "retry", item.claim_generation, {
        reason: "manual_handoff",
        previousAgentActorId: item.assigned_agent_actor_id,
    });
    return mapItem(await getItem(id, actorId, database));
}

export function handOffFailedAgentItem(id: string, actorId: string) {
    return withTransaction((database) =>
        handOffFailedAgentItemInTransaction(id, actorId, database),
    );
}

export async function supersedeQuestionWorkItems(
    questionId: string,
    newVersionId: string,
    actorId: string,
    database: QueryExecutor,
    excludeItemId?: string,
) {
    const cancelled = await database.query<{ id: string; claim_generation: number }>(
        `UPDATE public.work_items SET status = 'cancelled', claim_token = NULL,
         claimed_by = NULL, claimed_agent_actor_id = NULL,
         lease_until = NULL, updated_at = now()
         WHERE question_id = $1 AND question_version_id <> $2
         AND ($3::uuid IS NULL OR id <> $3)
         AND status IN ('pending', 'claimed') RETURNING id, claim_generation`,
        [questionId, newVersionId, excludeItemId ?? null],
    );
    for (const row of cancelled.rows)
        await event(database, row.id, actorId, "cancelled", row.claim_generation, {
            reason: "superseded",
        });
}
