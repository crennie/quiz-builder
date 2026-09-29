import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startAttemptInTransaction, submitAnswerInTransaction } from "../../src/db/attempts.ts";
import { createQuestionInTransaction, type QueryExecutor } from "../../src/db/question-bank.ts";
import { createQuizInTransaction, saveQuizContentInTransaction } from "../../src/db/quizzes.ts";
import { withTransaction } from "../../src/db/transaction.ts";

const ownerId = "00000000-0000-4000-8000-000000000601";
const learnerId = "00000000-0000-4000-8000-000000000602";
const questionContent = {
    prompt: "Capital of France?",
    questionType: "exact_text" as const,
    answerConfig: { questionType: "exact_text" as const, acceptedAnswers: ["Paris"] },
    gradingConfig: {
        questionType: "exact_text" as const,
        caseSensitive: false,
        trimWhitespace: true,
    },
    explanation: null,
};

describe.skipIf(!process.env.TEST_DATABASE_URL)("PostgreSQL transactions and row locks", () => {
    let pool: Pool;

    beforeAll(async () => {
        const url = new URL(process.env.TEST_DATABASE_URL!);
        if (
            url.pathname !== "/quiz_builder_test" ||
            !["localhost", "127.0.0.1"].includes(url.hostname)
        ) {
            throw new Error(
                "PostgreSQL integration tests require a local quiz_builder_test database",
            );
        }
        pool = new Pool({ connectionString: url.toString(), max: 4 });
        await pool.query("CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY)");
        await pool.query(
            readFileSync(
                resolve(
                    import.meta.dirname,
                    "../../../supabase/migrations/20260928174208_initial_schema.sql",
                ),
                "utf8",
            ),
        );
        for (const id of [ownerId, learnerId]) {
            await pool.query("INSERT INTO auth.users (id) VALUES ($1)", [id]);
            await pool.query("INSERT INTO public.profiles (id, display_name) VALUES ($1, 'User')", [
                id,
            ]);
        }
    });

    afterAll(async () => {
        await pool?.end();
    });

    async function fixture() {
        const question = await withTransaction(
            (client) =>
                createQuestionInTransaction(
                    ownerId,
                    { content: questionContent, visibility: "private", status: "published" },
                    client,
                ),
            pool,
        );
        const content = {
            title: "Original",
            description: null,
            settings: { shuffleQuestions: false, showAnswersAfterCompletion: true },
            questions: [
                {
                    questionId: question.id,
                    questionVersionId: question.currentVersion.id,
                    points: 2.5,
                    required: true,
                    timeLimitSeconds: null,
                },
            ],
        };
        const quiz = await withTransaction(
            (client) =>
                createQuizInTransaction(
                    ownerId,
                    { content, visibility: "public", status: "published" },
                    client,
                ),
            pool,
        );
        return { quiz, content };
    }

    it("rolls back a multi-row write after a later statement fails", async () => {
        const { quiz, content } = await fixture();
        const failure = new Error("injected membership failure");
        await expect(
            withTransaction((client) => {
                const failingExecutor = {
                    query: (sql: string, values?: unknown[]) => {
                        if (sql.includes("INSERT INTO public.quiz_version_questions")) {
                            throw failure;
                        }
                        return client.query(sql, values);
                    },
                } as unknown as QueryExecutor;
                return saveQuizContentInTransaction(
                    quiz.id,
                    ownerId,
                    { ...content, title: "Should roll back" },
                    failingExecutor,
                );
            }, pool),
        ).rejects.toBe(failure);
        const versions = await pool.query<{ count: string }>(
            "SELECT count(*) FROM public.quiz_versions WHERE quiz_id = $1",
            [quiz.id],
        );
        expect(Number(versions.rows[0]?.count)).toBe(1);
        const current = await pool.query<{ current_version_id: string }>(
            "SELECT current_version_id FROM public.quizzes WHERE id = $1",
            [quiz.id],
        );
        expect(current.rows[0]?.current_version_id).toBe(quiz.currentVersion.id);
    });

    it("serializes concurrent identical and changed quiz saves", async () => {
        const { quiz, content } = await fixture();
        const save = (title: string) =>
            withTransaction(
                (client) =>
                    saveQuizContentInTransaction(quiz.id, ownerId, { ...content, title }, client),
                pool,
            );
        const identical = await Promise.all([save("Same"), save("Same")]);
        expect(identical.map((item) => item.currentVersion.id)).toEqual([
            identical[0]?.currentVersion.id,
            identical[0]?.currentVersion.id,
        ]);
        await Promise.all([save("Alpha"), save("Beta")]);
        const versions = await pool.query<{ version_number: number }>(
            "SELECT version_number FROM public.quiz_versions WHERE quiz_id = $1 ORDER BY version_number",
            [quiz.id],
        );
        expect(versions.rows.map((row) => row.version_number)).toEqual([1, 2, 3, 4]);
        const current = await pool.query<{ version_number: number }>(
            `SELECT v.version_number FROM public.quizzes q
             JOIN public.quiz_versions v ON v.id = q.current_version_id WHERE q.id = $1`,
            [quiz.id],
        );
        expect(current.rows[0]?.version_number).toBe(4);
    });

    it("accepts only one of two concurrent answers to the same attempt question", async () => {
        const { quiz } = await fixture();
        const started = await withTransaction(
            (client) => startAttemptInTransaction(quiz.id, learnerId, client),
            pool,
        );
        const attemptQuestionId = started.questions[0]?.id;
        expect(attemptQuestionId).toBeDefined();
        const answer = (text: string) =>
            withTransaction(
                (client) =>
                    submitAnswerInTransaction(
                        started.id,
                        attemptQuestionId,
                        learnerId,
                        { questionType: "exact_text", text },
                        client,
                    ),
                pool,
            );
        const outcomes = await Promise.allSettled([answer("Paris"), answer("London")]);
        expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
        const rejected = outcomes.find((outcome) => outcome.status === "rejected");
        expect(rejected).toMatchObject({ reason: { code: "QUESTION_ALREADY_ANSWERED" } });
        const row = await pool.query<{ user_response: { text: string }; points_awarded: string }>(
            "SELECT user_response, points_awarded FROM public.quiz_attempt_questions WHERE id = $1",
            [attemptQuestionId],
        );
        expect(["Paris", "London"]).toContain(row.rows[0]?.user_response.text);
        expect(Number(row.rows[0]?.points_awarded)).toBe(
            row.rows[0]?.user_response.text === "Paris" ? 2.5 : 0,
        );
    });
});
