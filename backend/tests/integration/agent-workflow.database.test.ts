import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./apply-migrations.ts";
import {
    claimAgentQuestionInTransaction,
    completeAgentQuestionInTransaction,
    enqueueAgentQuestionInTransaction,
} from "../../src/agent/creation.ts";
import {
    claimWorkflowItemInTransaction,
    completeWorkflowItemInTransaction,
    failWorkflowItemInTransaction,
} from "../../src/agent/workflow.ts";
import {
    GATE_AGENT_ID,
    REVIEW_AGENT_ID,
    REVISION_AGENT_ID,
    claimWorkItemInTransaction,
    decideWorkItemInTransaction,
    handOffFailedAgentItemInTransaction,
    listWorkItems,
    submitQuestionReviewInTransaction,
} from "../../src/db/content-workflow.ts";
import { createQuestionInTransaction, type QueryExecutor } from "../../src/db/question-bank.ts";
import type { AgentGeneration } from "../../src/agent/provider.ts";

const owner = "00000000-0000-4000-8000-000000000801";
const content = {
    prompt: "What is the largest planet?",
    questionType: "exact_text" as const,
    answerConfig: { questionType: "exact_text" as const, acceptedAnswers: ["Jupiter"] },
    gradingConfig: {
        questionType: "exact_text" as const,
        caseSensitive: false,
        trimWhitespace: true,
    },
    explanation: "Jupiter is the largest planet.",
};
const generation: AgentGeneration = {
    content,
    metadata: { latencyMs: 1, providerRunId: "create-1" },
};
const provenance = { name: "test-provider", model: "test-model" };

describe("agent content workflow", () => {
    let database: PGlite;
    let sql: QueryExecutor;
    let sequence = 0;
    beforeAll(async () => {
        database = new PGlite();
        sql = database as unknown as QueryExecutor;
        await database.exec("CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY)");
        await applyMigrations((migration) => database.exec(migration));
        await database.query("INSERT INTO auth.users (id) VALUES ($1)", [owner]);
        await database.query(
            "INSERT INTO public.profiles (id, display_name) VALUES ($1, 'Owner')",
            [owner],
        );
        process.env.CONTENT_AGENT_REVIEW = "true";
        process.env.CONTENT_AGENT_REVISION = "true";
        process.env.CONTENT_AGENT_GATE = "true";
    });
    afterAll(async () => {
        delete process.env.CONTENT_AGENT_REVIEW;
        delete process.env.CONTENT_AGENT_REVISION;
        delete process.env.CONTENT_AGENT_GATE;
        await database.close();
    });

    async function create() {
        sequence += 1;
        const key = `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
        await enqueueAgentQuestionInTransaction(
            owner,
            { brief: "Create a question about planets", requestKey: key },
            sql,
        );
        const claim = await claimAgentQuestionInTransaction(sql);
        return completeAgentQuestionInTransaction(claim!, generation, provenance, sql);
    }

    it("reviews an exact agent version and publishes only through the final gate service", async () => {
        const created = await create();
        const reviewItem = (await listWorkItems(owner, sql)).items.find(
            (item) => item.id === created.reviewItemId,
        )!;
        expect(reviewItem.assignedAgentActorId).toBe(REVIEW_AGENT_ID);
        await expect(claimWorkItemInTransaction(reviewItem.id, owner, sql)).rejects.toMatchObject({
            code: "WORK_ITEM_MACHINE_ONLY",
        });
        const review = await claimWorkflowItemInTransaction("review", sql);
        expect(review?.versionId).toBe(created.versionId);
        expect(await claimWorkflowItemInTransaction("gate", sql)).toBeNull();
        await completeWorkflowItemInTransaction(
            review!,
            {
                role: "review",
                decision: "approved",
                findings: "Correct answer.",
                metadata: { latencyMs: 2, providerRunId: "review-1" },
            },
            provenance,
            sql,
        );
        const before = await database.query<{
            status: string;
            default_published_version_id: string | null;
        }>("SELECT status, default_published_version_id FROM public.questions WHERE id = $1", [
            created.questionId,
        ]);
        expect(before.rows[0]).toMatchObject({
            status: "draft",
            default_published_version_id: null,
        });
        const gate = await claimWorkflowItemInTransaction("gate", sql);
        expect(gate?.agentId).toBe(GATE_AGENT_ID);
        await completeWorkflowItemInTransaction(
            gate!,
            {
                role: "gate",
                decision: "approve_and_publish",
                findings: "Ready.",
                metadata: { latencyMs: 3, providerRunId: "gate-1" },
            },
            provenance,
            sql,
        );
        await completeWorkflowItemInTransaction(
            gate!,
            {
                role: "gate",
                decision: "approve_and_publish",
                findings: "Ready.",
                metadata: { latencyMs: 3, providerRunId: "gate-1" },
            },
            provenance,
            sql,
        );
        const after = await database.query<{
            status: string;
            default_published_version_id: string;
        }>("SELECT status, default_published_version_id FROM public.questions WHERE id = $1", [
            created.questionId,
        ]);
        expect(after.rows[0]).toMatchObject({
            status: "published",
            default_published_version_id: created.versionId,
        });
        const decisions = await database.query<{
            review_actor: string;
            gate_actor: string;
            provider: string;
            event_actor: string | null;
        }>(
            `SELECT r.agent_actor_id AS review_actor, g.agent_actor_id AS gate_actor,
             x.provider, e.actor_id AS event_actor
             FROM public.question_review_decisions r
             JOIN public.question_publication_gate_decisions g ON g.submission_id = r.submission_id
             JOIN public.agent_execution_runs x ON x.id = g.agent_execution_run_id
             JOIN public.question_publication_events e ON e.question_version_id = $1 AND e.event_type = 'published'
             WHERE r.submission_id = $2`,
            [created.versionId, gate!.submissionId],
        );
        expect(decisions.rows[0]).toEqual({
            review_actor: REVIEW_AGENT_ID,
            gate_actor: GATE_AGENT_ID,
            provider: provenance.name,
            event_actor: null,
        });
    });

    it("turns requested changes into an immutable agent revision and a new review", async () => {
        const created = await create();
        const review = await claimWorkflowItemInTransaction("review", sql);
        await completeWorkflowItemInTransaction(
            review!,
            {
                role: "review",
                decision: "changes_requested",
                findings: "Clarify the prompt.",
                metadata: { latencyMs: 1 },
            },
            provenance,
            sql,
        );
        const revision = await claimWorkflowItemInTransaction("revision", sql);
        expect(revision?.agentId).toBe(REVISION_AGENT_ID);
        expect(revision?.findings).toContain("Clarify the prompt.");
        const revised = {
            role: "revision" as const,
            content: { ...content, prompt: "Name the largest planet in our Solar System." },
            metadata: { latencyMs: 4, providerRunId: "revision-1" },
        };
        await completeWorkflowItemInTransaction(revision!, revised, provenance, sql);
        await completeWorkflowItemInTransaction(revision!, revised, provenance, sql);
        const versions = await database.query<{ id: string; agent_run_id: string | null }>(
            "SELECT id, agent_run_id FROM public.question_versions WHERE question_id = $1 ORDER BY version_number",
            [created.questionId],
        );
        expect(versions.rows).toHaveLength(2);
        expect(versions.rows[0].id).toBe(created.versionId);
        expect(versions.rows[1].agent_run_id).toBeTruthy();
        const next = await claimWorkflowItemInTransaction("review", sql);
        expect(next?.versionId).toBe(versions.rows[1].id);
        const submissions = await database.query<{ count: number }>(
            "SELECT count(*)::int AS count FROM public.question_review_submissions WHERE question_id = $1",
            [created.questionId],
        );
        expect(submissions.rows[0].count).toBe(2);
        await completeWorkflowItemInTransaction(
            next!,
            {
                role: "review",
                decision: "changes_requested",
                findings: "Add a clearer explanation.",
                metadata: { latencyMs: 2 },
            },
            provenance,
            sql,
        );
        const secondRevision = await claimWorkflowItemInTransaction("revision", sql);
        await completeWorkflowItemInTransaction(
            secondRevision!,
            {
                role: "revision",
                content: { ...content, prompt: "Which planet is largest in the Solar System?" },
                metadata: { latencyMs: 2 },
            },
            provenance,
            sql,
        );
        const thirdReview = await claimWorkflowItemInTransaction("review", sql);
        await completeWorkflowItemInTransaction(
            thirdReview!,
            {
                role: "review",
                decision: "changes_requested",
                findings: "Needs manual review.",
                metadata: { latencyMs: 2 },
            },
            provenance,
            sql,
        );
        const manual = (await listWorkItems(owner, sql)).items.find(
            (item) =>
                item.itemType === "REVISE_QUESTION" &&
                item.questionId === created.questionId &&
                item.status === "pending",
        );
        expect(manual?.assignedAgentActorId).toBeNull();
    });

    it("routes a reviewer's own generation to a human reviewer", async () => {
        const job = await database.query<{ id: string }>(
            `INSERT INTO public.work_items
             (queue_name, item_type, assigned_to, assigned_agent_actor_id, status, input, operation_key)
             VALUES ('question-creation', 'CREATE_QUESTION', $1, $2, 'completed',
              '{"schemaVersion":1,"type":"CREATE_QUESTION","brief":"A source question"}'::jsonb,
              $3) RETURNING id`,
            [owner, REVIEW_AGENT_ID, `test-self:${crypto.randomUUID()}`],
        );
        const run = await database.query<{ id: string }>(
            `INSERT INTO public.agent_generation_runs
             (agent_actor_id, sponsor_id, work_item_id, provider, model)
             VALUES ($1, $2, $3, 'test', 'test') RETURNING id`,
            [REVIEW_AGENT_ID, owner, job.rows[0].id],
        );
        const question = await createQuestionInTransaction(
            owner,
            { content, visibility: "private" },
            sql,
            run.rows[0].id,
        );
        const review = await submitQuestionReviewInTransaction(
            question.id,
            question.currentVersion.id,
            owner,
            sql,
        );
        expect(review.assignedAgentActorId).toBeNull();
    });

    it("fences an expired claim after another worker reclaims the review", async () => {
        const created = await create();
        const old = await claimWorkflowItemInTransaction("review", sql);
        expect(old?.versionId).toBe(created.versionId);
        await database.query(
            "UPDATE public.work_items SET lease_until = now() - interval '1 second' WHERE id = $1",
            [old!.id],
        );
        const current = await claimWorkflowItemInTransaction("review", sql);
        expect(current?.generation).toBe(old!.generation + 1);
        await expect(
            completeWorkflowItemInTransaction(
                old!,
                {
                    role: "review",
                    decision: "approved",
                    findings: "Old claim",
                    metadata: { latencyMs: 1 },
                },
                provenance,
                sql,
            ),
        ).rejects.toMatchObject({ code: "STALE_WORK_ITEM_CLAIM" });
        await completeWorkflowItemInTransaction(
            current!,
            {
                role: "review",
                decision: "approved",
                findings: "Current claim",
                metadata: { latencyMs: 1 },
            },
            provenance,
            sql,
        );
    });

    it("lets the sponsor recover a failed agent review as human work", async () => {
        const created = await create();
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const claim = await claimWorkflowItemInTransaction("review", sql);
            await failWorkflowItemInTransaction(claim!, "provider_failure", sql);
        }
        const failed = (await listWorkItems(owner, sql)).items.find(
            (item) => item.id === created.reviewItemId,
        );
        expect(failed?.status).toBe("failed");
        await expect(
            handOffFailedAgentItemInTransaction(
                created.reviewItemId,
                "00000000-0000-4000-8000-000000000802",
                sql,
            ),
        ).rejects.toMatchObject({ code: "WORK_ITEM_NOT_FOUND" });
        const handed = await handOffFailedAgentItemInTransaction(created.reviewItemId, owner, sql);
        expect(handed).toMatchObject({
            status: "pending",
            attempts: 0,
            assignedAgentActorId: null,
        });
        const human = await claimWorkItemInTransaction(created.reviewItemId, owner, sql);
        await decideWorkItemInTransaction(
            human.id,
            owner,
            human.claimToken!,
            "approved",
            "Reviewed manually after provider failure",
            sql,
        );
        const gate = (await listWorkItems(owner, sql)).items.find(
            (item) =>
                item.itemType === "APPROVE_PUBLICATION" && item.questionId === created.questionId,
        );
        expect(gate?.assignedAgentActorId).toBe(GATE_AGENT_ID);
    });
});
