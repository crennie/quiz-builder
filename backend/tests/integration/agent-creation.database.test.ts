import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./apply-migrations.ts";
import {
    claimAgentQuestionInTransaction,
    completeAgentQuestionInTransaction,
    enqueueAgentQuestionInTransaction,
    failAgentQuestionInTransaction,
    QUESTION_AGENT_ID,
    type AgentClaim,
} from "../../src/agent/creation.ts";
import type { AgentGeneration } from "../../src/agent/provider.ts";
import {
    createQuestionVersionInTransaction,
    getBankQuestionDetail,
    getQuestionDetail,
    publishQuestionInTransaction,
    type QueryExecutor,
} from "../../src/db/question-bank.ts";
import { claimWorkItemInTransaction, listWorkItems } from "../../src/db/content-workflow.ts";

const sponsor = "00000000-0000-4000-8000-000000000301";
const other = "00000000-0000-4000-8000-000000000302";
const generation: AgentGeneration = {
    content: {
        prompt: "What is the largest planet?",
        questionType: "exact_text",
        answerConfig: { questionType: "exact_text", acceptedAnswers: ["Jupiter"] },
        gradingConfig: { questionType: "exact_text", caseSensitive: false, trimWhitespace: true },
        explanation: "Jupiter is the largest planet in the Solar System.",
    },
    metadata: { providerRunId: "test-run", latencyMs: 3 },
};

const provider = { name: "test-provider", model: "test-model" };

describe("agent question creation", () => {
    let database: PGlite;
    let sql: QueryExecutor;
    beforeAll(async () => {
        database = new PGlite();
        sql = database as unknown as QueryExecutor;
        await database.exec("CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY)");
        await applyMigrations((migration) => database.exec(migration));
        for (const id of [sponsor, other]) {
            await database.query("INSERT INTO auth.users (id) VALUES ($1)", [id]);
            await database.query(
                "INSERT INTO public.profiles (id, display_name) VALUES ($1, 'Tester')",
                [id],
            );
        }
    });
    afterAll(async () => {
        await database.close();
    });

    it("creates one private agent draft and one human review item atomically", async () => {
        const requestKey = "00000000-0000-4000-8000-000000000311";
        const job = await enqueueAgentQuestionInTransaction(
            sponsor,
            { brief: "Create a question about planets", requestKey },
            sql,
        );
        const duplicate = await enqueueAgentQuestionInTransaction(
            sponsor,
            { brief: "Create a question about planets", requestKey },
            sql,
        );
        expect(duplicate.id).toBe(job.id);
        await expect(claimWorkItemInTransaction(job.id, sponsor, sql)).rejects.toMatchObject({
            code: "WORK_ITEM_MACHINE_ONLY",
        });
        await expect(
            enqueueAgentQuestionInTransaction(
                sponsor,
                { brief: "A different brief about stars", requestKey },
                sql,
            ),
        ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
        expect(
            (await listWorkItems(other, sql)).items.find((item) => item.id === job.id),
        ).toBeUndefined();
        const claim = await claimAgentQuestionInTransaction(sql);
        expect(claim?.id).toBe(job.id);
        expect(
            (await listWorkItems(sponsor, sql)).items.find((item) => item.id === job.id)
                ?.claimToken,
        ).toBeNull();
        await database.exec("BEGIN");
        const created = await completeAgentQuestionInTransaction(claim!, generation, provider, sql);
        await database.exec("COMMIT");
        const detail = await getQuestionDetail(created.questionId, sponsor, sql);
        expect(detail?.status).toBe("draft");
        expect(detail?.visibility).toBe("private");
        expect(detail?.currentVersion.agentRunId).toBeTruthy();
        expect(await getQuestionDetail(created.questionId, other, sql)).toBeNull();
        expect(await getBankQuestionDetail(created.questionId, null, sql)).toBeNull();
        await expect(
            publishQuestionInTransaction(created.questionId, sponsor, created.versionId, sql),
        ).rejects.toMatchObject({ code: "AGENT_REVIEW_REQUIRED" });
        const reviews = (await listWorkItems(sponsor, sql)).items.filter(
            (item) => item.itemType === "REVIEW_QUESTION" && item.questionId === created.questionId,
        );
        expect(reviews).toHaveLength(1);
        expect(reviews[0]?.id).toBe(created.reviewItemId);
        const policy = await database.query<{
            policy_snapshot: { source: string; agentOriginRunId: string };
        }>(
            `SELECT policy_snapshot FROM public.question_review_submissions
             WHERE question_version_id = $1`,
            [created.versionId],
        );
        expect(policy.rows[0]?.policy_snapshot).toMatchObject({
            source: "agent",
            agentOriginRunId: detail!.currentVersion.agentRunId,
        });
        const provenance = await database.query<{
            agent_actor_id: string;
            sponsor_id: string;
            provider: string;
            model: string;
        }>(
            `SELECT agent_actor_id, sponsor_id, provider, model FROM public.agent_generation_runs
             WHERE id = $1`,
            [detail!.currentVersion.agentRunId],
        );
        expect(provenance.rows[0]).toEqual({
            agent_actor_id: QUESTION_AGENT_ID,
            sponsor_id: sponsor,
            provider: provider.name,
            model: provider.model,
        });
        await expect(
            completeAgentQuestionInTransaction(claim!, generation, provider, sql),
        ).rejects.toMatchObject({ code: "STALE_WORK_ITEM_CLAIM" });
        const revised = await createQuestionVersionInTransaction(
            created.questionId,
            sponsor,
            { ...generation.content, prompt: "A human revision" },
            sql,
        );
        await expect(
            publishQuestionInTransaction(
                created.questionId,
                sponsor,
                revised.currentVersion.id,
                sql,
            ),
        ).rejects.toMatchObject({ code: "AGENT_REVIEW_REQUIRED" });
    });

    it("fences expired claims and keeps failed attempts out of question storage", async () => {
        const job = await enqueueAgentQuestionInTransaction(
            sponsor,
            {
                brief: "Create a question about rivers",
                requestKey: "00000000-0000-4000-8000-000000000312",
            },
            sql,
        );
        const old = (await claimAgentQuestionInTransaction(sql)) as AgentClaim;
        expect(old.id).toBe(job.id);
        await database.query(
            `UPDATE public.work_items SET lease_until = now() - interval '1 second'
            WHERE id = $1`,
            [job.id],
        );
        const current = (await claimAgentQuestionInTransaction(sql)) as AgentClaim;
        expect(current.generation).toBe(old.generation + 1);
        await expect(
            completeAgentQuestionInTransaction(
                { ...current, sponsorId: other },
                generation,
                provider,
                sql,
            ),
        ).rejects.toMatchObject({ code: "STALE_WORK_ITEM_CLAIM" });
        await expect(
            completeAgentQuestionInTransaction(old, generation, provider, sql),
        ).rejects.toMatchObject({ code: "STALE_WORK_ITEM_CLAIM" });
        await failAgentQuestionInTransaction(current, "provider_failure", sql);
        const last = (await claimAgentQuestionInTransaction(sql)) as AgentClaim;
        await failAgentQuestionInTransaction(last, "provider_failure", sql);
        const jobs = await database.query<{ status: string }>(
            `SELECT status FROM public.work_items WHERE id = $1`,
            [job.id],
        );
        expect(jobs.rows[0]?.status).toBe("failed");
        const runs = await database.query<{ count: number }>(
            `SELECT count(*)::int AS count FROM public.agent_generation_runs WHERE work_item_id = $1`,
            [job.id],
        );
        expect(runs.rows[0]?.count).toBe(0);
    });

    it("limits each sponsor's active creation backlog", async () => {
        for (let index = 0; index < 5; index += 1) {
            await enqueueAgentQuestionInTransaction(
                sponsor,
                {
                    brief: `Create question number ${index} about astronomy`,
                    requestKey: `00000000-0000-4000-8000-00000000032${index}`,
                },
                sql,
            );
        }
        await expect(
            enqueueAgentQuestionInTransaction(
                sponsor,
                {
                    brief: "Create another question about astronomy",
                    requestKey: "00000000-0000-4000-8000-000000000326",
                },
                sql,
            ),
        ).rejects.toMatchObject({ code: "AGENT_QUEUE_LIMIT" });
    });
});
