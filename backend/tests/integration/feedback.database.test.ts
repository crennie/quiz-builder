import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
    testDatabase,
    transaction,
    fixture,
    owner,
    other,
    third,
    content,
    quizContent,
} from "./v1-fixtures.ts";
import { createQuestionInTransaction } from "../../src/db/question-bank.ts";
import { createQuizInTransaction } from "../../src/db/quizzes.ts";
import { startAttemptInTransaction } from "../../src/db/attempts.ts";
import {
    createFeedback,
    listReceivedFeedback,
    updateFeedbackStatus,
} from "../../src/db/feedback.ts";
describe("feedback access", () => {
    let s: Awaited<ReturnType<typeof testDatabase>>;
    beforeAll(async () => {
        s = await testDatabase();
    });
    afterAll(async () => s.db.close());
    it("authorizes direct content feedback and owner-only triage", async () => {
        const { db, sql } = s;
        const { question, quiz } = await transaction(db, () => fixture(sql));
        await expect(
            createFeedback(
                other,
                { questionId: question.id, category: "typo", comment: "Private" },
                sql,
            ),
        ).rejects.toMatchObject({ code: "FEEDBACK_TARGET_NOT_FOUND" });
        await expect(
            createFeedback(other, { quizId: quiz.id, category: "other", comment: "Private" }, sql),
        ).rejects.toMatchObject({ code: "FEEDBACK_TARGET_NOT_FOUND" });
        const f = await createFeedback(
            owner,
            { questionId: question.id, category: "typo", comment: "Typo" },
            sql,
        );
        expect(
            (await listReceivedFeedback(owner, { limit: 50, offset: 0 }, sql)).items,
        ).toContainEqual(f);
        await expect(updateFeedbackStatus(f.id, other, "resolved", sql)).rejects.toMatchObject({
            code: "FEEDBACK_NOT_FOUND",
        });
        const resolved = await updateFeedbackStatus(f.id, owner, "resolved", sql);
        expect(resolved.reviewedAt).not.toBeNull();
        expect((await updateFeedbackStatus(f.id, owner, "open", sql)).reviewedAt).toBeNull();
        for (const cols of ["", ",question_id,quiz_id"]) {
            const values = cols ? ",$2,$3" : "";
            await expect(
                sql.query(
                    `INSERT INTO public.feedback(submitted_by,category,comment${cols}) VALUES($1,'other','Invalid'${values})`,
                    cols ? [owner, question.id, quiz.id] : [owner],
                ),
            ).rejects.toMatchObject({ code: "23514" });
        }
    });
    it("delivers attempted-question feedback to both quiz and source owners without exposing learner attempts", async () => {
        const { db, sql } = s;
        const q = await createQuestionInTransaction(other, { content }, sql);
        await sql.query("UPDATE public.questions SET visibility='public' WHERE id=$1", [q.id]);
        const quiz = await transaction(db, () =>
            createQuizInTransaction(owner, { content: quizContent(q.id) }, sql),
        );
        await sql.query("UPDATE public.quizzes SET visibility='public' WHERE id=$1", [quiz.id]);
        const a = await transaction(db, () => startAttemptInTransaction(quiz.id, third, sql));
        await expect(
            createFeedback(
                owner,
                {
                    quizAttemptQuestionId: a.questions[0].id,
                    category: "unfair_grading",
                    comment: "Foreign",
                },
                sql,
            ),
        ).rejects.toMatchObject({ code: "FEEDBACK_TARGET_NOT_FOUND" });
        const f = await createFeedback(
            third,
            {
                quizAttemptQuestionId: a.questions[0].id,
                category: "unfair_grading",
                comment: "Check",
            },
            sql,
        );
        for (const id of [owner, other])
            expect(
                (await listReceivedFeedback(id, { limit: 50, offset: 0 }, sql)).items,
            ).toContainEqual(f);
        expect(
            (await listReceivedFeedback(third, { limit: 50, offset: 0 }, sql)).items,
        ).not.toContainEqual(f);
        expect((await updateFeedbackStatus(f.id, other, "reviewed", sql)).status).toBe("reviewed");
        expect(
            await createFeedback(
                third,
                { questionId: q.id, category: "other", comment: "Public" },
                sql,
            ),
        ).toMatchObject({ questionId: q.id });
    });
});
