import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { startAttemptInTransaction } from "../../src/db/attempts.ts";
import {
    createFeedback,
    listReceivedFeedback,
    updateFeedbackStatus,
} from "../../src/db/feedback.ts";
import { createQuestionInTransaction, type QueryExecutor } from "../../src/db/question-bank.ts";
import { createQuizInTransaction, updateQuizMetadataInTransaction } from "../../src/db/quizzes.ts";

const ownerId = "00000000-0000-4000-8000-000000000401";
const learnerId = "00000000-0000-4000-8000-000000000402";
const outsiderId = "00000000-0000-4000-8000-000000000403";
const content = {
    prompt: "What is two plus two?",
    questionType: "exact_text" as const,
    answerConfig: { questionType: "exact_text" as const, acceptedAnswers: ["4"] },
    gradingConfig: {
        questionType: "exact_text" as const,
        caseSensitive: false,
        trimWhitespace: true,
    },
    explanation: null,
};

describe("feedback persistence", () => {
    let database: PGlite;
    let sql: QueryExecutor;

    beforeAll(async () => {
        database = new PGlite();
        sql = database as unknown as QueryExecutor;
        await database.exec("CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY)");
        await database.exec(
            readFileSync(
                resolve(
                    import.meta.dirname,
                    "../../../supabase/migrations/20260928174208_initial_schema.sql",
                ),
                "utf8",
            ),
        );
        for (const id of [ownerId, learnerId, outsiderId]) {
            await database.query("INSERT INTO auth.users (id) VALUES ($1)", [id]);
            await database.query(
                "INSERT INTO public.profiles (id, display_name) VALUES ($1, 'User')",
                [id],
            );
        }
    });
    afterAll(async () => database.close());
    beforeEach(async () => database.exec("BEGIN"));
    afterEach(async () => database.exec("ROLLBACK"));

    async function fixture(questionOwnerId = ownerId) {
        const question = await createQuestionInTransaction(
            questionOwnerId,
            {
                content,
                visibility: "public",
                status: "published",
            },
            sql,
        );
        const quiz = await createQuizInTransaction(
            ownerId,
            {
                content: {
                    title: "Practice",
                    description: null,
                    settings: { shuffleQuestions: false, showAnswersAfterCompletion: true },
                    questions: [
                        {
                            questionId: question.id,
                            questionVersionId: question.currentVersion.id,
                            points: 1,
                            required: true,
                            timeLimitSeconds: null,
                        },
                    ],
                },
                visibility: "public",
                status: "published",
            },
            sql,
        );
        const attempt = await startAttemptInTransaction(quiz.id, learnerId, sql);
        return { question, quiz, attempt };
    }

    it("accepts every target type and lets content owners review feedback", async () => {
        const { question, quiz, attempt } = await fixture();
        const questionFeedback = await createFeedback(
            learnerId,
            {
                questionId: question.id,
                category: "typo",
                comment: " Typo in prompt ",
            },
            sql,
        );
        const quizFeedback = await createFeedback(
            learnerId,
            {
                quizId: quiz.id,
                category: "other",
                comment: "Helpful practice",
            },
            sql,
        );
        const attemptFeedback = await createFeedback(
            learnerId,
            {
                quizAttemptQuestionId: attempt.questions[0].id,
                category: "unfair_grading",
                comment: "Please review this answer",
            },
            sql,
        );
        expect(questionFeedback).toMatchObject({
            questionId: question.id,
            quizId: null,
            status: "open",
        });
        expect(quizFeedback).toMatchObject({ quizId: quiz.id, questionId: null });
        expect(attemptFeedback).toMatchObject({
            quizAttemptQuestionId: attempt.questions[0].id,
            questionId: null,
            quizId: null,
        });
        const received = await listReceivedFeedback(ownerId, { limit: 2, offset: 0 }, sql);
        expect(received.items).toHaveLength(2);
        expect(received.nextOffset).toBe(2);
        expect(
            (await listReceivedFeedback(ownerId, { limit: 20, offset: 0 }, sql)).items,
        ).toHaveLength(3);
        expect(
            (await listReceivedFeedback(learnerId, { limit: 20, offset: 0 }, sql)).items,
        ).toEqual([]);
        await expect(
            updateFeedbackStatus(questionFeedback.id, learnerId, "reviewed", sql),
        ).rejects.toMatchObject({ code: "FEEDBACK_NOT_FOUND" });
        const reviewed = await updateFeedbackStatus(questionFeedback.id, ownerId, "reviewed", sql);
        expect(reviewed.reviewedAt).not.toBeNull();
        const resolved = await updateFeedbackStatus(questionFeedback.id, ownerId, "resolved", sql);
        expect(resolved.reviewedAt).toBe(reviewed.reviewedAt);
        const reopened = await updateFeedbackStatus(questionFeedback.id, ownerId, "open", sql);
        expect(reopened.reviewedAt).toBeNull();
    });

    it("rejects private or archived targets and foreign attempt questions", async () => {
        const { question, quiz, attempt } = await fixture();
        await expect(
            createFeedback(
                outsiderId,
                {
                    quizAttemptQuestionId: attempt.questions[0].id,
                    category: "other",
                    comment: "Not my attempt",
                },
                sql,
            ),
        ).rejects.toMatchObject({
            code: "FEEDBACK_TARGET_NOT_FOUND",
        });
        await updateQuizMetadataInTransaction(quiz.id, ownerId, { visibility: "private" }, sql);
        await expect(
            createFeedback(
                outsiderId,
                { quizId: quiz.id, category: "other", comment: "Hidden" },
                sql,
            ),
        ).rejects.toMatchObject({ code: "FEEDBACK_TARGET_NOT_FOUND" });
        await database.query("UPDATE public.questions SET status = 'archived' WHERE id = $1", [
            question.id,
        ]);
        await expect(
            createFeedback(
                outsiderId,
                { questionId: question.id, category: "other", comment: "Archived" },
                sql,
            ),
        ).rejects.toMatchObject({ code: "FEEDBACK_TARGET_NOT_FOUND" });
        expect(
            (await listReceivedFeedback(outsiderId, { limit: 20, offset: 0 }, sql)).items,
        ).toEqual([]);
    });

    it("shows attempted-question feedback to quiz and source-question owners", async () => {
        const { attempt } = await fixture(outsiderId);
        const feedback = await createFeedback(
            learnerId,
            {
                quizAttemptQuestionId: attempt.questions[0].id,
                category: "ambiguous_question",
                comment: "This wording is unclear",
            },
            sql,
        );
        expect(
            (await listReceivedFeedback(ownerId, { limit: 20, offset: 0 }, sql)).items[0]?.id,
        ).toBe(feedback.id);
        expect(
            (await listReceivedFeedback(outsiderId, { limit: 20, offset: 0 }, sql)).items[0]?.id,
        ).toBe(feedback.id);
        expect((await updateFeedbackStatus(feedback.id, outsiderId, "reviewed", sql)).status).toBe(
            "reviewed",
        );
    });

    it("enforces exactly one target in the database", async () => {
        const { question, quiz } = await fixture();
        await database.exec("SAVEPOINT invalid_feedback");
        await expect(
            database.query(
                `INSERT INTO public.feedback (submitted_by, category, comment)
             VALUES ($1, 'other', 'missing target')`,
                [learnerId],
            ),
        ).rejects.toThrow();
        await database.exec("ROLLBACK TO SAVEPOINT invalid_feedback");
        await expect(
            database.query(
                `INSERT INTO public.feedback (submitted_by, question_id, quiz_id, category, comment)
             VALUES ($1, $2, $3, 'other', 'two targets')`,
                [learnerId, question.id, quiz.id],
            ),
        ).rejects.toThrow();
        await database.exec("ROLLBACK TO SAVEPOINT invalid_feedback");
    });
});
