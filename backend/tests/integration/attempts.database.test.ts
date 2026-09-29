import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
    completeAttemptInTransaction,
    getAttempt,
    listAttempts,
    startAttemptInTransaction,
    submitAnswerInTransaction,
} from "../../src/db/attempts.ts";
import {
    createQuestionInTransaction,
    createQuestionVersionInTransaction,
    type QueryExecutor,
} from "../../src/db/question-bank.ts";
import {
    createQuizInTransaction,
    saveQuizContentInTransaction,
    updateQuizMetadataInTransaction,
} from "../../src/db/quizzes.ts";

const ownerId = "00000000-0000-4000-8000-000000000301";
const takerId = "00000000-0000-4000-8000-000000000302";
const otherId = "00000000-0000-4000-8000-000000000303";
const settings = { shuffleQuestions: false, showAnswersAfterCompletion: true };

describe("quiz attempts", () => {
    let database: PGlite;
    let sql: QueryExecutor;

    beforeAll(async () => {
        database = new PGlite();
        sql = database as unknown as QueryExecutor;
        const migration = readFileSync(
            resolve(
                import.meta.dirname,
                "../../../supabase/migrations/20260928174208_initial_schema.sql",
            ),
            "utf8",
        );
        await database.exec("CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY)");
        await database.exec(migration);
        for (const id of [ownerId, takerId, otherId]) {
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

    async function fixture(visibility: "public" | "unlisted" | "private" = "public") {
        const contents = [
            {
                prompt: "Capital of France?",
                questionType: "exact_text" as const,
                answerConfig: { questionType: "exact_text" as const, acceptedAnswers: ["Paris"] },
                gradingConfig: {
                    questionType: "exact_text" as const,
                    caseSensitive: false,
                    trimWhitespace: true,
                },
                explanation: "Paris is the capital.",
            },
            {
                prompt: "Choose one",
                questionType: "multiple_choice_single" as const,
                answerConfig: {
                    questionType: "multiple_choice_single" as const,
                    options: [
                        { id: "a", text: "A" },
                        { id: "b", text: "B" },
                    ],
                    correctOptionId: "b",
                },
                gradingConfig: { questionType: "multiple_choice_single" as const },
                explanation: null,
            },
            {
                prompt: "Choose both",
                questionType: "multiple_choice_multi" as const,
                answerConfig: {
                    questionType: "multiple_choice_multi" as const,
                    options: [
                        { id: "a", text: "A" },
                        { id: "b", text: "B" },
                        { id: "c", text: "C" },
                    ],
                    correctOptionIds: ["a", "c"],
                },
                gradingConfig: { questionType: "multiple_choice_multi" as const },
                explanation: null,
            },
        ];
        const questions = [];
        for (const content of contents) {
            questions.push(
                await createQuestionInTransaction(
                    ownerId,
                    {
                        content,
                        visibility: "private",
                        status: "published",
                    },
                    sql,
                ),
            );
        }
        const content = {
            title: "Original title",
            description: null,
            settings,
            questions: questions.map((question, index) => ({
                questionId: question.id,
                questionVersionId: question.currentVersion.id,
                points: [2.5, 0.25, 1][index],
                required: index !== 2,
                timeLimitSeconds: null,
            })),
        };
        const quiz = await createQuizInTransaction(
            ownerId,
            {
                content,
                visibility,
                status: "published",
            },
            sql,
        );
        return { quiz, questions, content, contents };
    }

    it("evaluates snapshots, completes, and preserves results after source versions change", async () => {
        const { quiz, questions, content, contents } = await fixture();
        const started = await startAttemptInTransaction(quiz.id, takerId, sql);
        expect(started.quizVersionId).toBe(quiz.currentVersion.id);
        expect(started.questions.map((question) => question.prompt)).toEqual(
            contents.map((item) => item.prompt),
        );
        expect(started.questions[1]?.options).toEqual(contents[1]?.answerConfig.options);
        expect(JSON.stringify(started)).not.toContain("correctOptionId");
        expect(JSON.stringify(started)).not.toContain("acceptedAnswers");
        await expect(completeAttemptInTransaction(started.id, takerId, sql)).rejects.toMatchObject({
            code: "REQUIRED_ANSWERS_MISSING",
        });
        await expect(getAttempt(started.id, otherId, sql)).rejects.toMatchObject({
            code: "ATTEMPT_NOT_FOUND",
        });
        await expect(
            submitAnswerInTransaction(
                started.id,
                started.questions[0].id,
                otherId,
                { questionType: "exact_text", text: "Paris" },
                sql,
            ),
        ).rejects.toMatchObject({ code: "ATTEMPT_NOT_FOUND" });
        await expect(
            submitAnswerInTransaction(
                started.id,
                started.questions[1].id,
                takerId,
                { questionType: "multiple_choice_single", optionId: "missing" },
                sql,
            ),
        ).rejects.toMatchObject({ code: "INVALID_CHOICE" });

        const afterText = await submitAnswerInTransaction(
            started.id,
            started.questions[0].id,
            takerId,
            { questionType: "exact_text", text: " paris " },
            sql,
        );
        expect(afterText.questions[0]?.evaluationResult).toBeNull();
        await expect(
            submitAnswerInTransaction(
                started.id,
                started.questions[0].id,
                takerId,
                { questionType: "exact_text", text: "wrong" },
                sql,
            ),
        ).rejects.toMatchObject({
            code: "QUESTION_ALREADY_ANSWERED",
        });
        await submitAnswerInTransaction(
            started.id,
            started.questions[1].id,
            takerId,
            { questionType: "multiple_choice_single", optionId: "a" },
            sql,
        );
        await submitAnswerInTransaction(
            started.id,
            started.questions[2].id,
            takerId,
            { questionType: "multiple_choice_multi", optionIds: ["c", "a"] },
            sql,
        );
        const completed = await completeAttemptInTransaction(started.id, takerId, sql);
        expect(completed.scoreSummary).toEqual({ pointsPossible: 3.75, pointsAwarded: 3.5 });
        expect(completed.questions.map((question) => question.evaluationResult?.isCorrect)).toEqual(
            [true, false, true],
        );
        expect(completed.questions[0]?.explanation).toBe("Paris is the capital.");
        expect(completed.questions[0]?.correctAnswer).toEqual(contents[0]?.answerConfig);
        await expect(
            submitAnswerInTransaction(
                started.id,
                started.questions[1].id,
                takerId,
                { questionType: "multiple_choice_single", optionId: "b" },
                sql,
            ),
        ).rejects.toMatchObject({ code: "ATTEMPT_CLOSED" });
        await expect(completeAttemptInTransaction(started.id, takerId, sql)).rejects.toMatchObject({
            code: "ATTEMPT_CLOSED",
        });

        await createQuestionVersionInTransaction(
            questions[0].id,
            ownerId,
            {
                ...contents[0],
                prompt: "New prompt",
                answerConfig: {
                    questionType: "exact_text",
                    acceptedAnswers: ["London"],
                },
            },
            sql,
        );
        await saveQuizContentInTransaction(
            quiz.id,
            ownerId,
            { ...content, title: "New title" },
            sql,
        );
        const history = await getAttempt(started.id, takerId, sql);
        expect(history.quizTitle).toBe("Original title");
        expect(history.questions[0]?.prompt).toBe("Capital of France?");
        expect(history.scoreSummary).toEqual(completed.scoreSummary);
        expect((await listAttempts(takerId, { limit: 20, offset: 0 }, sql)).items[0]?.id).toBe(
            started.id,
        );
        expect((await listAttempts(otherId, { limit: 20, offset: 0 }, sql)).items).toEqual([]);
    });

    it("enforces quiz visibility and lifecycle at start", async () => {
        const { quiz } = await fixture("private");
        await expect(startAttemptInTransaction(quiz.id, takerId, sql)).rejects.toMatchObject({
            code: "QUIZ_NOT_FOUND",
        });
        expect((await startAttemptInTransaction(quiz.id, ownerId, sql)).status).toBe("in_progress");
        await updateQuizMetadataInTransaction(quiz.id, ownerId, { visibility: "unlisted" }, sql);
        expect((await startAttemptInTransaction(quiz.id, takerId, sql)).status).toBe("in_progress");
        await updateQuizMetadataInTransaction(quiz.id, ownerId, { status: "archived" }, sql);
        await expect(startAttemptInTransaction(quiz.id, takerId, sql)).rejects.toMatchObject({
            code: "QUIZ_NOT_FOUND",
        });
    });

    it("allows unanswered optional questions and hides explanations when configured", async () => {
        const { quiz, content } = await fixture();
        await saveQuizContentInTransaction(
            quiz.id,
            ownerId,
            {
                ...content,
                settings: { ...settings, showAnswersAfterCompletion: false },
            },
            sql,
        );
        const started = await startAttemptInTransaction(quiz.id, takerId, sql);
        await submitAnswerInTransaction(
            started.id,
            started.questions[0].id,
            takerId,
            { questionType: "exact_text", text: "Paris" },
            sql,
        );
        await submitAnswerInTransaction(
            started.id,
            started.questions[1].id,
            takerId,
            { questionType: "multiple_choice_single", optionId: "b" },
            sql,
        );
        const completed = await completeAttemptInTransaction(started.id, takerId, sql);
        expect(completed.scoreSummary).toEqual({ pointsPossible: 3.75, pointsAwarded: 2.75 });
        expect(completed.questions[0]?.explanation).toBeNull();
        expect(completed.questions[0]?.correctAnswer).toBeNull();
        expect(completed.questions[0]?.evaluationResult?.explanation).toBeNull();
        expect(completed.questions[2]?.pointsAwarded).toBeNull();
    });
});
