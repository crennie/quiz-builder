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
import { createQuizInTransaction } from "../../src/db/quizzes.ts";
import {
    startAttemptInTransaction,
    submitAnswerInTransaction,
    completeAttemptInTransaction,
    getAttempt,
    listAttempts,
} from "../../src/db/attempts.ts";
describe("snapshot attempts", () => {
    let s: Awaited<ReturnType<typeof testDatabase>>;
    beforeAll(async () => {
        s = await testDatabase();
    });
    afterAll(async () => s.db.close());
    it("takes a private quiz, grades fractional points, and preserves history after independent replacements", async () => {
        const { db, sql } = s;
        const { quiz } = await transaction(db, () => fixture(sql));
        await expect(startAttemptInTransaction(quiz.id, other, sql)).rejects.toMatchObject({
            code: "QUIZ_NOT_FOUND",
        });
        const a = await transaction(db, () => startAttemptInTransaction(quiz.id, owner, sql));
        expect(a).toMatchObject({
            quizTitle: "Geography",
            status: "in_progress",
            settings: { showAnswersAfterCompletion: true },
        });
        expect(a.questions[0]).toMatchObject({
            prompt: content.prompt,
            required: true,
            timeLimitSeconds: 30,
            pointsPossible: 2.5,
            correctAnswer: null,
        });
        await expect(getAttempt(a.id, other, sql)).rejects.toMatchObject({
            code: "ATTEMPT_NOT_FOUND",
        });
        await expect(completeAttemptInTransaction(a.id, owner, sql)).rejects.toMatchObject({
            code: "REQUIRED_ANSWERS_MISSING",
        });
        await expect(
            submitAnswerInTransaction(
                a.id,
                a.questions[0].id,
                owner,
                { questionType: "multiple_choice_single", optionId: "a" },
                sql,
            ),
        ).rejects.toMatchObject({ code: "RESPONSE_TYPE_MISMATCH" });
        const answered = await transaction(db, () =>
            submitAnswerInTransaction(
                a.id,
                a.questions[0].id,
                owner,
                { questionType: "exact_text", text: " Paris " },
                sql,
            ),
        );
        expect(answered.questions[0].pointsAwarded).toBeNull();
        await expect(
            submitAnswerInTransaction(
                a.id,
                a.questions[0].id,
                owner,
                { questionType: "exact_text", text: "Again" },
                sql,
            ),
        ).rejects.toMatchObject({ code: "QUESTION_ALREADY_ANSWERED" });
        const completed = await transaction(db, () =>
            completeAttemptInTransaction(a.id, owner, sql),
        );
        expect(completed.scoreSummary).toEqual({ pointsPossible: 2.5, pointsAwarded: 2.5 });
        expect(completed.questions[0].correctAnswer).toEqual(content.answerConfig);
        const replacement = await createQuestionInTransaction(
            owner,
            {
                content: {
                    ...content,
                    prompt: "Replacement",
                    answerConfig: { questionType: "exact_text", acceptedAnswers: ["London"] },
                },
            },
            sql,
        );
        await transaction(db, () =>
            createQuizInTransaction(owner, { content: quizContent(replacement.id) }, sql),
        );
        expect(await getAttempt(a.id, owner, sql)).toEqual(completed);
        expect((await listAttempts(owner, { limit: 50, offset: 0 }, sql)).items).toContainEqual(
            completed,
        );
        for (const set of [
            "question_snapshot='{}'",
            "answer_snapshot='{}'",
            "grading_snapshot='{}'",
            "required=false",
            "time_limit_seconds=99",
            "points_possible=99",
            "position=99",
            "user_response='{}'",
        ])
            await expect(
                sql.query(`UPDATE public.quiz_attempt_questions SET ${set} WHERE id=$1`, [
                    a.questions[0].id,
                ]),
            ).rejects.toMatchObject({ code: "23514" });
        for (const set of ["quiz_title_snapshot='Bypass'", "settings_snapshot='{}'"])
            await expect(
                sql.query(`UPDATE public.quiz_attempts SET ${set} WHERE id=$1`, [a.id]),
            ).rejects.toMatchObject({ code: "23514" });
    });
    it("rejects empty quizzes and hides answers using snapshotted settings", async () => {
        const { db, sql } = s;
        const empty = await transaction(db, () =>
            createQuizInTransaction(
                owner,
                { content: { ...quizContent(owner), questions: [] } },
                sql,
            ),
        );
        await expect(startAttemptInTransaction(empty.id, owner, sql)).rejects.toMatchObject({
            code: "EMPTY_QUIZ",
        });
        const q = await createQuestionInTransaction(owner, { content }, sql);
        const input = quizContent(q.id);
        input.settings.showAnswersAfterCompletion = false;
        input.questions[0].required = false;
        const quiz = await transaction(db, () =>
            createQuizInTransaction(owner, { content: input }, sql),
        );
        const a = await transaction(db, () => startAttemptInTransaction(quiz.id, owner, sql));
        await transaction(db, () =>
            submitAnswerInTransaction(
                a.id,
                a.questions[0].id,
                owner,
                { questionType: "exact_text", text: "Paris" },
                sql,
            ),
        );
        const end = await transaction(db, () => completeAttemptInTransaction(a.id, owner, sql));
        expect(end.questions[0]).toMatchObject({
            correctAnswer: null,
            explanation: null,
            evaluationResult: { explanation: null },
        });
    });
    it("validates choices and preserves optional unanswered questions and shuffled repetition", async () => {
        const { db, sql } = s;
        const q = await createQuestionInTransaction(
            owner,
            {
                content: {
                    prompt: "Choose A",
                    questionType: "multiple_choice_single",
                    answerConfig: {
                        questionType: "multiple_choice_single",
                        options: [
                            { id: "a", text: "A" },
                            { id: "b", text: "B" },
                        ],
                        correctOptionId: "a",
                    },
                    gradingConfig: { questionType: "multiple_choice_single" },
                    explanation: null,
                },
            },
            sql,
        );
        const input = quizContent(q.id);
        input.settings.shuffleQuestions = true;
        input.questions = [
            { ...input.questions[0], required: false },
            { ...input.questions[0], required: false },
        ];
        const quiz = await transaction(db, () =>
            createQuizInTransaction(owner, { content: input }, sql),
        );
        const a = await transaction(db, () => startAttemptInTransaction(quiz.id, owner, sql));
        expect(a.questions).toHaveLength(2);
        await expect(
            submitAnswerInTransaction(
                a.id,
                a.questions[0].id,
                owner,
                { questionType: "multiple_choice_single", optionId: "missing" },
                sql,
            ),
        ).rejects.toMatchObject({ code: "INVALID_CHOICE" });
        const completed = await transaction(db, () =>
            completeAttemptInTransaction(a.id, owner, sql),
        );
        expect(completed.scoreSummary).toEqual({ pointsPossible: 5, pointsAwarded: 0 });
    });
    it("rejects partial snapshots, later snapshot additions, and reopening completed results", async () => {
        const { db, sql } = s;
        const { quiz } = await transaction(db, () => fixture(sql));
        await expect(
            transaction(db, async () => {
                await sql.query(
                    `INSERT INTO public.quiz_attempts(quiz_id,user_id,quiz_title_snapshot,settings_snapshot)
             SELECT id,$2,title,settings FROM public.quizzes WHERE id=$1`,
                    [quiz.id, owner],
                );
            }),
        ).rejects.toMatchObject({ code: "23514" });
        const a = await transaction(db, () => startAttemptInTransaction(quiz.id, owner, sql));
        await expect(
            sql.query(
                `INSERT INTO public.quiz_attempt_questions(quiz_attempt_id,question_id,position,question_snapshot,answer_snapshot,grading_snapshot,required,time_limit_seconds,points_possible)
         SELECT quiz_attempt_id,question_id,99,question_snapshot,answer_snapshot,grading_snapshot,required,time_limit_seconds,points_possible
         FROM public.quiz_attempt_questions WHERE id=$1`,
                [a.questions[0].id],
            ),
        ).rejects.toMatchObject({ code: "23514" });
        await transaction(db, () =>
            submitAnswerInTransaction(
                a.id,
                a.questions[0].id,
                owner,
                { questionType: "exact_text", text: "Paris" },
                sql,
            ),
        );
        await transaction(db, () => completeAttemptInTransaction(a.id, owner, sql));
        for (const set of ["status='in_progress'", "score_summary='{}'"])
            await expect(
                sql.query(`UPDATE public.quiz_attempts SET ${set} WHERE id=$1`, [a.id]),
            ).rejects.toMatchObject({ code: "23514" });
    });
});
