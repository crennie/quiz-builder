import assert from "node:assert/strict";
import test from "node:test";

import {
    answerConfigSchema,
    evaluationResultSchema,
    feedbackCategorySchema,
    questionTypeSchema,
    questionVersionContentSchema,
    quizContentSchema,
    userResponseSchema,
} from "./index.ts";

test("V1 question types exclude unevaluable fuzzy questions", () => {
    assert.equal(questionTypeSchema.safeParse("fuzzy").success, false);
    assert.equal(questionTypeSchema.safeParse("multiple_choice_multi").success, true);
});

test("choice answer configuration references existing unique choices", () => {
    const valid = {
        questionType: "multiple_choice_multi",
        options: [
            { id: "a", text: "A" },
            { id: "b", text: "B" },
        ],
        correctOptionIds: ["a"],
    };
    assert.equal(answerConfigSchema.safeParse(valid).success, true);
    assert.equal(
        answerConfigSchema.safeParse({ ...valid, correctOptionIds: ["missing"] }).success,
        false,
    );
    assert.equal(
        answerConfigSchema.safeParse({ ...valid, correctOptionIds: ["a", "a"] }).success,
        false,
    );
});

test("a question version cannot mix answer and grading types", () => {
    assert.equal(
        questionVersionContentSchema.safeParse({
            prompt: "Prompt",
            questionType: "exact_text",
            answerConfig: { questionType: "exact_text", acceptedAnswers: ["yes"] },
            gradingConfig: { questionType: "multiple_choice_single" },
            explanation: null,
        }).success,
        false,
    );
});

test("responses and results retain fractional numeric scores", () => {
    assert.equal(
        userResponseSchema.safeParse({ questionType: "exact_text", text: "answer" }).success,
        true,
    );
    assert.equal(
        evaluationResultSchema.safeParse({
            isCorrect: true,
            pointsPossible: 2.5,
            pointsAwarded: 1.25,
            explanation: null,
        }).success,
        true,
    );
});

test("feedback categories match the V1 set", () => {
    assert.equal(feedbackCategorySchema.safeParse("unfair_grading").success, true);
    assert.equal(feedbackCategorySchema.safeParse("general_chat").success, false);
});

test("quiz content requires explicit question versions and permits fractional points", () => {
    const content = {
        title: " Study ",
        description: null,
        settings: { shuffleQuestions: false, showAnswersAfterCompletion: true },
        questions: [
            {
                questionId: "00000000-0000-4000-8000-000000000001",
                questionVersionId: "00000000-0000-4000-8000-000000000002",
                points: 0.25,
                required: false,
                timeLimitSeconds: null,
            },
        ],
    };
    assert.equal(quizContentSchema.parse(content).title, "Study");
    assert.equal(
        quizContentSchema.safeParse({
            ...content,
            questions: [
                {
                    questionId: content.questions[0]?.questionId,
                    points: 1,
                    required: true,
                    timeLimitSeconds: null,
                },
            ],
        }).success,
        false,
    );
});
