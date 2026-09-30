import {
    questionVersionContentSchema,
    workItemResultSchema,
    type QuestionVersionContent,
} from "@quiz-builder/contracts";
import { AppError } from "../errors/app-error.ts";
import { withTransaction } from "../db/transaction.ts";
import { createQuestionVersionInTransaction, type QueryExecutor } from "../db/question-bank.ts";
import {
    decideWorkItemInTransaction,
    GATE_AGENT_ID,
    REVIEW_AGENT_ID,
    REVISION_AGENT_ID,
    submitQuestionReviewInTransaction,
    type WorkflowPolicy,
} from "../db/content-workflow.ts";
import { agentGenerationMetadataSchema } from "./provider.ts";
import type { AgentRole, WorkflowOutput } from "./workflow-provider.ts";

const roles = {
    review: { id: REVIEW_AGENT_ID, type: "REVIEW_QUESTION", queue: "question-review" },
    revision: { id: REVISION_AGENT_ID, type: "REVISE_QUESTION", queue: "question-revision" },
    gate: { id: GATE_AGENT_ID, type: "APPROVE_PUBLICATION", queue: "question-ready-to-publish" },
} as const;
type Item = {
    id: string;
    assigned_to: string;
    question_id: string;
    question_version_id: string;
    submission_id: string;
    status: string;
    claim_token: string | null;
    claim_generation: number;
    attempts: number;
    lease_until: string | Date | null;
    assigned_agent_actor_id: string | null;
    claimed_agent_actor_id: string | null;
};
export type WorkflowClaim = {
    id: string;
    role: AgentRole;
    agentId: string;
    sponsorId: string;
    questionId: string;
    versionId: string;
    submissionId: string;
    token: string;
    generation: number;
    content: QuestionVersionContent;
    findings: string;
};

async function machineEvent(
    database: QueryExecutor,
    claim: WorkflowClaim,
    type: string,
    details: Record<string, unknown> = {},
) {
    await database.query(
        `INSERT INTO public.work_item_events
         (work_item_id, agent_actor_id, event_type, claim_generation, details)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [claim.id, claim.agentId, type, claim.generation, JSON.stringify(details)],
    );
}

export async function claimWorkflowItemInTransaction(
    role: AgentRole,
    database: QueryExecutor,
): Promise<WorkflowClaim | null> {
    const assignment = roles[role];
    const exhausted = await database.query<Item>(
        `UPDATE public.work_items SET status = 'failed', claim_token = NULL,
         claimed_agent_actor_id = NULL, lease_until = NULL, updated_at = now()
         WHERE assigned_agent_actor_id = $1 AND item_type = $2 AND status = 'claimed'
         AND lease_until <= now() AND attempts >= 3 RETURNING *`,
        [assignment.id, assignment.type],
    );
    for (const row of exhausted.rows)
        await database.query(
            `INSERT INTO public.work_item_events
         (work_item_id, agent_actor_id, event_type, claim_generation, details)
         VALUES ($1, $2, 'failed', $3, '{"reason":"retry_exhausted"}'::jsonb)`,
            [row.id, assignment.id, row.claim_generation],
        );
    const selected = await database.query<Item>(
        `SELECT * FROM public.work_items WHERE assigned_agent_actor_id = $1
         AND item_type = $2 AND queue_name = $3 AND attempts < 3
         AND (status = 'pending' OR (status = 'claimed' AND lease_until <= now()))
         ORDER BY created_at, id FOR UPDATE SKIP LOCKED LIMIT 1`,
        [assignment.id, assignment.type, assignment.queue],
    );
    const item = selected.rows[0];
    if (!item) return null;
    const source = await database.query<{
        prompt: string;
        question_type: string;
        answer_config: unknown;
        grading_config: unknown;
        explanation: string | null;
    }>(
        `SELECT prompt, question_type, answer_config, grading_config, explanation
        FROM public.question_versions WHERE id = $1 AND question_id = $2`,
        [item.question_version_id, item.question_id],
    );
    const content = questionVersionContentSchema.parse({
        prompt: source.rows[0].prompt,
        questionType: source.rows[0].question_type,
        answerConfig: source.rows[0].answer_config,
        gradingConfig: source.rows[0].grading_config,
        explanation: source.rows[0].explanation,
    });
    const prior = await database.query<{ findings: string }>(
        `SELECT findings FROM public.question_review_decisions WHERE submission_id = $1
         UNION ALL SELECT findings FROM public.question_publication_gate_decisions WHERE submission_id = $1`,
        [item.submission_id],
    );
    const updated = await database.query<Item>(
        `UPDATE public.work_items SET status = 'claimed', claim_token = gen_random_uuid(),
         claim_generation = claim_generation + 1, attempts = attempts + 1,
         claimed_by = NULL, claimed_agent_actor_id = $2,
         lease_until = now() + interval '5 minutes', updated_at = now()
         WHERE id = $1 RETURNING *`,
        [item.id, assignment.id],
    );
    const row = updated.rows[0];
    const claim: WorkflowClaim = {
        id: row.id,
        role,
        agentId: assignment.id,
        sponsorId: row.assigned_to,
        questionId: row.question_id,
        versionId: row.question_version_id,
        submissionId: row.submission_id,
        token: row.claim_token!,
        generation: row.claim_generation,
        content,
        findings: prior.rows
            .map((value) => value.findings)
            .filter(Boolean)
            .join("\n"),
    };
    await machineEvent(database, claim, "claimed");
    return claim;
}
export function claimWorkflowItem(role: AgentRole) {
    return withTransaction((database) => claimWorkflowItemInTransaction(role, database));
}

async function lockClaim(claim: WorkflowClaim, database: QueryExecutor) {
    const rows = await database.query<Item>(
        `SELECT * FROM public.work_items WHERE id = $1 FOR UPDATE`,
        [claim.id],
    );
    const row = rows.rows[0];
    if (
        !row ||
        row.status !== "claimed" ||
        row.claim_token !== claim.token ||
        row.claim_generation !== claim.generation ||
        row.assigned_to !== claim.sponsorId ||
        row.assigned_agent_actor_id !== claim.agentId ||
        row.claimed_agent_actor_id !== claim.agentId ||
        row.question_id !== claim.questionId ||
        row.question_version_id !== claim.versionId ||
        row.submission_id !== claim.submissionId ||
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

export async function completeWorkflowItemInTransaction(
    claim: WorkflowClaim,
    output: WorkflowOutput,
    provider: { name: string; model: string },
    database: QueryExecutor,
) {
    if (claim.role !== output.role)
        throw new AppError(400, "INVALID_AGENT_RESULT", "Result role mismatch");
    await database.query(`SELECT id FROM public.questions WHERE id = $1 FOR UPDATE`, [
        claim.questionId,
    ]);
    const existing = await database.query<Item>(
        `SELECT * FROM public.work_items WHERE id = $1 FOR UPDATE`,
        [claim.id],
    );
    const finished = existing.rows[0];
    if (
        finished?.status === "completed" &&
        finished.claim_token === claim.token &&
        finished.claim_generation === claim.generation &&
        finished.assigned_agent_actor_id === claim.agentId &&
        finished.claimed_agent_actor_id === claim.agentId
    ) {
        if (output.role === "revision") {
            const revision = await database.query<{
                prompt: string;
                question_type: string;
                answer_config: unknown;
                grading_config: unknown;
                explanation: string | null;
            }>(
                `SELECT v.prompt, v.question_type, v.answer_config, v.grading_config, v.explanation
                FROM public.question_versions v JOIN public.agent_generation_runs r ON r.id = v.agent_run_id
                WHERE r.work_item_id = $1`,
                [claim.id],
            );
            const content =
                revision.rows[0] &&
                questionVersionContentSchema.parse({
                    prompt: revision.rows[0].prompt,
                    questionType: revision.rows[0].question_type,
                    answerConfig: revision.rows[0].answer_config,
                    gradingConfig: revision.rows[0].grading_config,
                    explanation: revision.rows[0].explanation,
                });
            if (content && JSON.stringify(content) === JSON.stringify(output.content)) return;
        } else {
            const table =
                output.role === "review"
                    ? "question_review_decisions"
                    : "question_publication_gate_decisions";
            const decision = await database.query<{ decision: string; findings: string }>(
                `SELECT decision, findings FROM public.${table} WHERE work_item_id = $1`,
                [claim.id],
            );
            if (
                decision.rows[0]?.decision === output.decision &&
                decision.rows[0]?.findings === output.findings
            )
                return;
        }
        throw new AppError(409, "DECISION_ALREADY_RECORDED", "This item has a different result");
    }
    await lockClaim(claim, database);
    if (output.role === "revision") {
        const prior = await database.query<{ policy_snapshot: WorkflowPolicy }>(
            `SELECT policy_snapshot FROM public.question_review_submissions WHERE id = $1`,
            [claim.submissionId],
        );
        const run = await database.query<{ id: string }>(
            `INSERT INTO public.agent_generation_runs
             (agent_actor_id, sponsor_id, work_item_id, provider, model, metadata)
             VALUES ($1, $2, $3, $4, $5, $6::jsonb) RETURNING id`,
            [
                claim.agentId,
                claim.sponsorId,
                claim.id,
                provider.name,
                provider.model,
                JSON.stringify(agentGenerationMetadataSchema.parse(output.metadata)),
            ],
        );
        const question = await createQuestionVersionInTransaction(
            claim.questionId,
            claim.sponsorId,
            output.content,
            database,
            run.rows[0].id,
            claim.id,
        );
        await submitQuestionReviewInTransaction(
            claim.questionId,
            question.currentVersion.id,
            claim.sponsorId,
            database,
            prior.rows[0].policy_snapshot,
        );
        const result = workItemResultSchema.parse({
            schemaVersion: 1,
            type: "REVISE_QUESTION",
            versionId: question.currentVersion.id,
            agentRunId: run.rows[0].id,
        });
        await database.query(
            `UPDATE public.work_items SET status = 'completed', updated_at = now()
            WHERE id = $1`,
            [claim.id],
        );
        await machineEvent(database, claim, "completed", { result });
        return;
    }
    const run = await database.query<{ id: string }>(
        `INSERT INTO public.agent_execution_runs
         (agent_actor_id, work_item_id, provider, model, metadata)
         VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
        [
            claim.agentId,
            claim.id,
            provider.name,
            provider.model,
            JSON.stringify(agentGenerationMetadataSchema.parse(output.metadata)),
        ],
    );
    await decideWorkItemInTransaction(
        claim.id,
        claim.sponsorId,
        claim.token,
        output.decision,
        output.findings,
        database,
        { id: claim.agentId, executionRunId: run.rows[0].id },
    );
}
export function completeWorkflowItem(
    claim: WorkflowClaim,
    output: WorkflowOutput,
    provider: { name: string; model: string },
) {
    return withTransaction((database) =>
        completeWorkflowItemInTransaction(claim, output, provider, database),
    );
}

export async function failWorkflowItemInTransaction(
    claim: WorkflowClaim,
    reason: string,
    database: QueryExecutor,
) {
    const item = await lockClaim(claim, database);
    const failed = item.attempts >= 3;
    await database.query(
        `UPDATE public.work_items SET status = $2, claim_token = NULL,
        claimed_agent_actor_id = NULL, lease_until = NULL, updated_at = now() WHERE id = $1`,
        [claim.id, failed ? "failed" : "pending"],
    );
    await machineEvent(database, claim, failed ? "failed" : "retry", {
        reason: reason.slice(0, 200),
    });
}
export function failWorkflowItem(claim: WorkflowClaim, reason: string) {
    return withTransaction((database) => failWorkflowItemInTransaction(claim, reason, database));
}

export async function processOneWorkflowItem(
    role: AgentRole,
    provider: (
        role: AgentRole,
        content: QuestionVersionContent,
        findings: string,
    ) => Promise<WorkflowOutput>,
    provenance: { name: string; model: string },
) {
    const claim = await claimWorkflowItem(role);
    if (!claim) return false;
    try {
        const output = await provider(role, claim.content, claim.findings);
        await completeWorkflowItem(claim, output, provenance);
    } catch (error) {
        if (error instanceof AppError && error.code === "STALE_WORK_ITEM_CLAIM") return true;
        try {
            await failWorkflowItem(claim, error instanceof Error ? error.name : "unknown");
        } catch (failure) {
            if (failure instanceof AppError && failure.code === "STALE_WORK_ITEM_CLAIM")
                return true;
            throw failure;
        }
    }
    return true;
}
