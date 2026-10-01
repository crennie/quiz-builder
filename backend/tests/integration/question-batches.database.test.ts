import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { QuestionBatchArtifact } from "@quiz-builder/contracts";
import { applyMigrations } from "./apply-migrations.ts";
import {
    ingestQuestionBatchInTransaction,
    listQuestionBatches,
    materializeQuestionBatchInTransaction,
} from "../../src/db/question-batches.ts";
import {
    createQuestionVersionInTransaction,
    publishQuestionInTransaction,
    type QueryExecutor,
} from "../../src/db/question-bank.ts";
import { submitQuestionReviewInTransaction } from "../../src/db/content-workflow.ts";

const sponsor = "00000000-0000-4000-8000-000000000801";
const other = "00000000-0000-4000-8000-000000000802";
const artifact: QuestionBatchArtifact = {
    schemaVersion: 1,
    batchKey: "00000000-0000-4000-8000-000000000803",
    topic: "REST endpoints",
    source: { kind: "external_agent", label: "Offline content agent" },
    tags: ["Technical", "Backend", "REST APIs"],
    questions: [
        {
            key: "rest-01",
            content: {
                prompt: "Which method retrieves an order?",
                questionType: "multiple_choice_single",
                answerConfig: {
                    questionType: "multiple_choice_single",
                    options: [
                        { id: "a", text: "GET" },
                        { id: "b", text: "DELETE" },
                    ],
                    correctOptionId: "a",
                },
                gradingConfig: { questionType: "multiple_choice_single" },
                explanation: "GET retrieves a resource representation.",
            },
        },
        {
            key: "rest-02",
            content: {
                prompt: "What status reports resource creation?",
                questionType: "exact_text",
                answerConfig: {
                    questionType: "exact_text",
                    acceptedAnswers: ["201", "201 Created"],
                },
                gradingConfig: {
                    questionType: "exact_text",
                    caseSensitive: false,
                    trimWhitespace: true,
                },
                explanation: "201 Created reports that a resource was created.",
            },
        },
    ],
};

describe("question batch artifact ingestion", () => {
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
    afterAll(async () => database.close());

    it("retains one immutable batch, creates tagged drafts on a separate idempotent step, and requires review", async () => {
        const imported = await ingestQuestionBatchInTransaction(sponsor, artifact, sql);
        expect(imported.items).toEqual([]);
        expect(imported.artifactSha256).toMatch(/^[a-f0-9]{64}$/);
        expect((await listQuestionBatches(sponsor, sql)).batches[0]).toMatchObject({
            id: imported.id,
            questionCount: 2,
            materializedCount: 0,
        });
        expect((await listQuestionBatches(other, sql)).batches).toEqual([]);
        expect((await ingestQuestionBatchInTransaction(sponsor, artifact, sql)).id).toBe(
            imported.id,
        );
        await expect(
            ingestQuestionBatchInTransaction(sponsor, { ...artifact, topic: "Changed" }, sql),
        ).rejects.toMatchObject({ code: "QUESTION_BATCH_CONFLICT" });

        await database.exec("BEGIN");
        const materialized = await materializeQuestionBatchInTransaction(imported.id, sponsor, sql);
        await database.exec("COMMIT");
        expect(materialized.items.map((item) => item.key)).toEqual(["rest-01", "rest-02"]);
        expect(
            (await materializeQuestionBatchInTransaction(imported.id, sponsor, sql)).items,
        ).toEqual(materialized.items);
        await expect(
            materializeQuestionBatchInTransaction(imported.id, other, sql),
        ).rejects.toMatchObject({
            code: "QUESTION_BATCH_NOT_FOUND",
        });
        const details = await database.query<{
            status: string;
            visibility: string;
            tag_count: number;
        }>(
            `SELECT q.status, q.visibility, count(t.tag_id)::int AS tag_count
             FROM public.questions q JOIN public.question_batch_items i ON i.question_id = q.id
             LEFT JOIN public.question_tags t ON t.question_id = q.id
             WHERE i.batch_id = $1 GROUP BY q.id ORDER BY q.created_at`,
            [imported.id],
        );
        expect(details.rows).toHaveLength(2);
        expect(
            details.rows.every(
                (row) =>
                    row.status === "draft" && row.visibility === "private" && row.tag_count === 3,
            ),
        ).toBe(true);

        const first = materialized.items[0];
        await expect(
            publishQuestionInTransaction(first.questionId, sponsor, first.versionId, sql),
        ).rejects.toMatchObject({ code: "BATCH_REVIEW_REQUIRED" });
        const previousReviewSetting = process.env.CONTENT_AGENT_REVIEW;
        process.env.CONTENT_AGENT_REVIEW = "true";
        let review;
        try {
            review = await submitQuestionReviewInTransaction(
                first.questionId,
                first.versionId,
                sponsor,
                sql,
            );
        } finally {
            if (previousReviewSetting === undefined) delete process.env.CONTENT_AGENT_REVIEW;
            else process.env.CONTENT_AGENT_REVIEW = previousReviewSetting;
        }
        expect(review.itemType).toBe("REVIEW_QUESTION");
        expect(review.assignedAgentActorId).toBeNull();
        const policy = await database.query<{
            policy_snapshot: { source: string; batchId: string };
        }>(
            `SELECT policy_snapshot FROM public.question_review_submissions
             WHERE question_version_id = $1`,
            [first.versionId],
        );
        expect(policy.rows[0].policy_snapshot).toMatchObject({
            source: "imported_external_agent",
            batchId: imported.id,
            reviewerAgentId: null,
        });
        await database.exec("BEGIN");
        const revised = await createQuestionVersionInTransaction(
            first.questionId,
            sponsor,
            { ...artifact.questions[0].content, prompt: "Which method reads an order?" },
            sql,
        );
        await database.exec("COMMIT");
        const mapping = (await materializeQuestionBatchInTransaction(imported.id, sponsor, sql))
            .items[0];
        expect(mapping.versionId).toBe(first.versionId);
        expect(mapping.currentVersionId).toBe(revised.currentVersion.id);
        await expect(
            publishQuestionInTransaction(first.questionId, sponsor, revised.currentVersion.id, sql),
        ).rejects.toMatchObject({ code: "BATCH_REVIEW_REQUIRED" });
        await expect(
            database.query(
                "UPDATE public.question_batches SET artifact_sha256 = $2 WHERE id = $1",
                [imported.id, "0".repeat(64)],
            ),
        ).rejects.toThrow();
    });

    it("rolls back every draft, mapping, and tag when a later batch item fails", async () => {
        const retained = await ingestQuestionBatchInTransaction(
            sponsor,
            { ...artifact, batchKey: "00000000-0000-4000-8000-000000000805" },
            sql,
        );
        const before = await database.query<{ questions: number; tags: number; tag_links: number }>(
            `SELECT
                (SELECT count(*)::int FROM public.questions) AS questions,
                (SELECT count(*)::int FROM public.tags) AS tags,
                (SELECT count(*)::int FROM public.question_tags) AS tag_links`,
        );
        await database.exec(`
            CREATE FUNCTION public.fail_second_batch_item() RETURNS trigger
            LANGUAGE plpgsql AS $$ BEGIN
                IF NEW.position = 1 THEN RAISE EXCEPTION 'second batch item rejected'; END IF;
                RETURN NEW;
            END $$;
            CREATE TRIGGER fail_second_batch_item
            BEFORE INSERT ON public.question_batch_items
            FOR EACH ROW EXECUTE FUNCTION public.fail_second_batch_item();
        `);
        try {
            await database.exec("BEGIN");
            await expect(
                materializeQuestionBatchInTransaction(retained.id, sponsor, sql),
            ).rejects.toThrow("second batch item rejected");
            await database.exec("ROLLBACK");
        } finally {
            await database.exec(
                "DROP TRIGGER fail_second_batch_item ON public.question_batch_items",
            );
            await database.exec("DROP FUNCTION public.fail_second_batch_item()");
        }
        const after = await database.query<{ questions: number; tags: number; tag_links: number }>(
            `SELECT
                (SELECT count(*)::int FROM public.questions) AS questions,
                (SELECT count(*)::int FROM public.tags) AS tags,
                (SELECT count(*)::int FROM public.question_tags) AS tag_links`,
        );
        expect(after.rows[0]).toEqual(before.rows[0]);
        expect(
            (
                await database.query(
                    "SELECT * FROM public.question_batch_items WHERE batch_id = $1",
                    [retained.id],
                )
            ).rows,
        ).toHaveLength(0);
        expect(
            (await listQuestionBatches(sponsor, sql)).batches.find(
                (batch) => batch.id === retained.id,
            ),
        ).toMatchObject({
            questionCount: 2,
            materializedCount: 0,
        });
        await database.exec("BEGIN");
        const retried = await materializeQuestionBatchInTransaction(retained.id, sponsor, sql);
        await database.exec("COMMIT");
        expect(retried.items).toHaveLength(2);
    });
});
