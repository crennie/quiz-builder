import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    testDatabase,
    transaction,
    fixture,
    owner,
    other,
    content,
    quizContent,
} from "./v1-fixtures.ts";
import { createQuestionInTransaction } from "../../src/db/question-bank.ts";
import {
    createQuizInTransaction,
    saveQuizContentInTransaction,
    getQuizDetail,
    listQuizzes,
    assignQuizTagInTransaction,
    removeQuizTagInTransaction,
} from "../../src/db/quizzes.ts";
import { createTag } from "../../src/db/question-bank.ts";
import { startAttemptInTransaction } from "../../src/db/attempts.ts";
describe("direct quizzes", () => {
    let s: Awaited<ReturnType<typeof testDatabase>>;
    beforeAll(async () => {
        s = await testDatabase();
    });
    afterAll(async () => s.db.close());
    it("allows direct composition editing, repetition, no-op saves, and owner-scoped tags", async () => {
        const { db, sql } = s;
        const { quiz, input } = await transaction(db, () => fixture(sql));
        const noop = await transaction(db, () =>
            saveQuizContentInTransaction(quiz.id, owner, input, sql),
        );
        expect(noop.questions).toEqual(quiz.questions);
        expect(noop.updatedAt).toBe(quiz.updatedAt);
        const repeat = await transaction(db, () =>
            saveQuizContentInTransaction(
                quiz.id,
                owner,
                {
                    ...input,
                    title: "Repeated",
                    questions: [...input.questions, ...input.questions],
                },
                sql,
            ),
        );
        expect(repeat.questions).toHaveLength(2);
        expect(repeat.questions.map((q) => q.position)).toEqual([0, 1]);
        const tag = await createTag(owner, "Quiz tag", sql);
        expect((await assignQuizTagInTransaction(quiz.id, tag.id, owner, sql)).tags).toEqual([tag]);
        await removeQuizTagInTransaction(quiz.id, tag.id, owner, sql);
        expect(await getQuizDetail(quiz.id, other, sql)).toBeNull();
        await expect(
            saveQuizContentInTransaction(quiz.id, other, input, sql),
        ).rejects.toMatchObject({ code: "QUIZ_NOT_FOUND" });
    });
    it("rejects foreign private questions, permits public IDs, and enforces public composition in SQL", async () => {
        const { db, sql } = s;
        const q = await createQuestionInTransaction(other, { content }, sql);
        const input = quizContent(q.id);
        await expect(
            transaction(db, () => createQuizInTransaction(owner, { content: input }, sql)),
        ).rejects.toMatchObject({ code: "QUESTION_NOT_FOUND" });
        await sql.query("UPDATE public.questions SET visibility='public' WHERE id=$1", [q.id]);
        const quiz = await transaction(db, () =>
            createQuizInTransaction(owner, { content: input }, sql),
        );
        await sql.query("UPDATE public.quizzes SET visibility='public' WHERE id=$1", [quiz.id]);
        expect(await getQuizDetail(quiz.id, null, sql)).toMatchObject({
            visibility: "public",
            isOwner: false,
            canEditContent: false,
        });
        await expect(
            sql.query("UPDATE public.questions SET visibility='private' WHERE id=$1", [q.id]),
        ).rejects.toMatchObject({ code: "23514" });
        const own = await transaction(db, () => fixture(sql));
        await expect(
            sql.query("UPDATE public.quizzes SET visibility='public' WHERE id=$1", [own.quiz.id]),
        ).rejects.toMatchObject({ code: "23514" });
        expect(
            (await listQuizzes({ viewerId: null, limit: 50, offset: 0 }, sql)).items.map(
                (q) => q.id,
            ),
        ).toContain(quiz.id);
        expect(
            (
                await listQuizzes({ viewerId: owner, scope: "mine", limit: 50, offset: 0 }, sql)
            ).items.every((q) => q.createdBy === owner),
        ).toBe(true);
        await expect(
            saveQuizContentInTransaction(quiz.id, owner, input, sql),
        ).rejects.toMatchObject({ code: "PUBLIC_CONTENT_READ_ONLY" });
    });
    for (const status of ["in_progress", "completed", "abandoned", "expired"] as const)
        it(`locks all content and composition after a ${status} attempt`, async () => {
            const { db, sql } = s;
            const { quiz, input } = await transaction(db, () => fixture(sql));
            const a = await transaction(db, () => startAttemptInTransaction(quiz.id, owner, sql));
            await sql.query("UPDATE public.quiz_attempts SET status=$2 WHERE id=$1", [
                a.id,
                status,
            ]);
            expect(await getQuizDetail(quiz.id, owner, sql)).toMatchObject({
                canEditContent: false,
            });
            expect(
                (
                    await transaction(db, () =>
                        saveQuizContentInTransaction(quiz.id, owner, input, sql),
                    )
                ).questions,
            ).toEqual(quiz.questions);
            for (const changed of [
                { ...input, title: "Changed" },
                { ...input, description: "Changed" },
                { ...input, settings: { ...input.settings, shuffleQuestions: true } },
                { ...input, questions: [] },
                { ...input, questions: input.questions.map((q) => ({ ...q, points: 3 })) },
            ])
                await expect(
                    transaction(db, () =>
                        saveQuizContentInTransaction(quiz.id, owner, changed, sql),
                    ),
                ).rejects.toMatchObject({ code: "QUIZ_CONTENT_LOCKED" });
            for (const query of [
                "UPDATE public.quizzes SET title='Bypass' WHERE id=$1",
                "UPDATE public.quizzes SET description='Bypass' WHERE id=$1",
                "UPDATE public.quizzes SET settings='{}' WHERE id=$1",
                "DELETE FROM public.quiz_questions WHERE quiz_id=$1",
                "UPDATE public.quiz_questions SET points=3 WHERE quiz_id=$1",
            ])
                await expect(sql.query(query, [quiz.id])).rejects.toMatchObject({ code: "23514" });
            await expect(
                sql.query("DELETE FROM public.quiz_attempts WHERE id=$1", [a.id]),
            ).rejects.toMatchObject({ code: "23514" });
        });
    it("rolls back changed quiz content and composition on a later membership failure", async () => {
        const { db, sql } = s;
        const { quiz, input } = await transaction(db, () => fixture(sql));
        const failing = {
            query: (text: string, values?: unknown[]) => {
                if (text.includes("INSERT INTO public.quiz_questions"))
                    throw new Error("Injected failure");
                return sql.query(text, values);
            },
        } as typeof sql;
        await expect(
            transaction(db, () =>
                saveQuizContentInTransaction(
                    quiz.id,
                    owner,
                    { ...input, title: "Discarded" },
                    failing,
                ),
            ),
        ).rejects.toThrow("Injected failure");
        expect(await getQuizDetail(quiz.id, owner, sql)).toEqual(quiz);
    });
});
