import { Pool, type PoolClient } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./apply-migrations.ts";
import { content, quizContent, owner, other } from "./v1-fixtures.ts";
import {
    createQuestionInTransaction,
    saveQuestionContentInTransaction,
} from "../../src/db/question-bank.ts";
import { createQuizInTransaction, saveQuizContentInTransaction } from "../../src/db/quizzes.ts";
import { startAttemptInTransaction, submitAnswerInTransaction } from "../../src/db/attempts.ts";
import { withTransaction } from "../../src/db/transaction.ts";
describe.skipIf(!process.env.TEST_DATABASE_URL)("PostgreSQL transactions and row locks", () => {
    let pool: Pool;
    beforeAll(async () => {
        const url = new URL(process.env.TEST_DATABASE_URL!);
        if (
            url.pathname !== "/quiz_builder_test" ||
            !["localhost", "127.0.0.1"].includes(url.hostname)
        )
            throw new Error("Tests require a disposable local quiz_builder_test database");
        pool = new Pool({ connectionString: url.toString(), max: 4 });
        const tables = await pool.query<{ count: string }>(
            "SELECT count(*) FROM pg_tables WHERE schemaname IN ('public','auth')",
        );
        if (Number(tables.rows[0].count) !== 0)
            throw new Error("Refusing to initialize a nonempty test database");
        await pool.query("CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY)");
        await applyMigrations((s) => pool.query(s));
        for (const id of [owner, other]) {
            await pool.query("INSERT INTO auth.users(id) VALUES($1)", [id]);
            await pool.query("INSERT INTO public.profiles(id,display_name) VALUES($1,'Tester')", [
                id,
            ]);
        }
    });
    afterAll(async () => pool?.end());
    async function question() {
        return withTransaction((c) => createQuestionInTransaction(owner, { content }, c), pool);
    }
    async function fixture() {
        const q = await question();
        const input = quizContent(q.id);
        const quiz = await withTransaction(
            (c) => createQuizInTransaction(owner, { content: input }, c),
            pool,
        );
        return { q, input, quiz };
    }
    async function race<A, B>(
        first: (c: PoolClient) => Promise<A>,
        second: (c: PoolClient) => Promise<B>,
    ) {
        const a = await pool.connect();
        const b = await pool.connect();
        let pending: Promise<PromiseSettledResult<B>> | undefined;
        try {
            await a.query("BEGIN");
            await b.query("BEGIN");
            const result = await first(a);
            const pid = (await b.query<{ pid: number }>("SELECT pg_backend_pid() AS pid")).rows[0]
                .pid;
            pending = second(b).then(
                (value) => ({ status: "fulfilled" as const, value }),
                (reason) => ({ status: "rejected" as const, reason: reason as unknown }),
            );
            const deadline = Date.now() + 3000;
            let waiting = false;
            while (Date.now() < deadline) {
                const r = await pool.query<{ blocked: boolean }>(
                    "SELECT cardinality(pg_blocking_pids($1))>0 AS blocked",
                    [pid],
                );
                if (r.rows[0].blocked) {
                    waiting = true;
                    break;
                }
                await new Promise((resolve) => setTimeout(resolve, 10));
            }
            expect(waiting).toBe(true);
            await a.query("COMMIT");
            const outcome = await pending;
            await b.query(outcome.status === "fulfilled" ? "COMMIT" : "ROLLBACK");
            return { result, outcome };
        } finally {
            await a.query("ROLLBACK");
            await pending;
            await b.query("ROLLBACK");
            a.release();
            b.release();
        }
    }
    it("serializes question edit before use and use before edit", async () => {
        const q = await question();
        const input = quizContent(q.id);
        const changed = { ...content, prompt: "Edited first" };
        const editFirst = await race(
            (c) => saveQuestionContentInTransaction(q.id, owner, changed, c),
            (c) => createQuizInTransaction(owner, { content: input }, c),
        );
        expect(editFirst.outcome).toMatchObject({
            status: "fulfilled",
            value: { questions: [{ question: { prompt: "Edited first" } }] },
        });
        const fresh = await question();
        const useFirst = await race(
            (c) => createQuizInTransaction(owner, { content: quizContent(fresh.id) }, c),
            (c) => saveQuestionContentInTransaction(fresh.id, owner, changed, c),
        );
        expect(useFirst.outcome).toMatchObject({
            status: "rejected",
            reason: { code: "QUESTION_CONTENT_LOCKED" },
        });
    });
    it("serializes quiz save before attempt and attempt before save", async () => {
        const { quiz, input } = await fixture();
        const saveFirst = await race(
            (c) =>
                saveQuizContentInTransaction(
                    quiz.id,
                    owner,
                    { ...input, title: "Edited first" },
                    c,
                ),
            (c) => startAttemptInTransaction(quiz.id, owner, c),
        );
        expect(saveFirst.outcome).toMatchObject({
            status: "fulfilled",
            value: { quizTitle: "Edited first" },
        });
        const fresh = await fixture();
        const attemptFirst = await race(
            (c) => startAttemptInTransaction(fresh.quiz.id, owner, c),
            (c) =>
                saveQuizContentInTransaction(
                    fresh.quiz.id,
                    owner,
                    { ...fresh.input, title: "Too late" },
                    c,
                ),
        );
        expect(attemptFirst.outcome).toMatchObject({
            status: "rejected",
            reason: { code: "QUIZ_CONTENT_LOCKED" },
        });
    });
    it("accepts only one concurrent answer to the same attempt question", async () => {
        const { quiz } = await fixture();
        const a = await withTransaction((c) => startAttemptInTransaction(quiz.id, owner, c), pool);
        const answer = (text: string) =>
            withTransaction(
                (c) =>
                    submitAnswerInTransaction(
                        a.id,
                        a.questions[0].id,
                        owner,
                        { questionType: "exact_text", text },
                        c,
                    ),
                pool,
            );
        const outcomes = await Promise.allSettled([answer("Paris"), answer("London")]);
        expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
        expect(outcomes.find((o) => o.status === "rejected")).toMatchObject({
            reason: { code: "QUESTION_ALREADY_ANSWERED" },
        });
    });
});
