import type { QuestionDetail, QuizDetail } from "@quiz-builder/contracts";
export const owner = "123e4567-e89b-42d3-a456-426614174030";
export const questionId = "223e4567-e89b-42d3-a456-426614174030";
export const quizId = "323e4567-e89b-42d3-a456-426614174030";
export const timestamp = "2026-10-13T00:00:00.000Z";
export const tag = {
    id: "423e4567-e89b-42d3-a456-426614174030",
    name: "Geography",
    slug: "geography",
    createdAt: timestamp,
};
export const question: QuestionDetail = {
    id: questionId,
    createdBy: owner,
    visibility: "private",
    createdAt: timestamp,
    updatedAt: timestamp,
    contentLockedAt: null,
    tags: [],
    isOwner: true,
    canEditContent: true,
    prompt: "Capital of France?",
    questionType: "exact_text",
    answerConfig: { questionType: "exact_text", acceptedAnswers: ["Paris"] },
    gradingConfig: { questionType: "exact_text", caseSensitive: false, trimWhitespace: true },
    explanation: null,
};
export const quiz: QuizDetail = {
    id: quizId,
    createdBy: owner,
    visibility: "private",
    createdAt: timestamp,
    updatedAt: timestamp,
    tags: [],
    isOwner: true,
    canEditContent: true,
    title: "Geography",
    description: null,
    settings: { shuffleQuestions: false, showAnswersAfterCompletion: true },
    questions: [
        {
            id: "523e4567-e89b-42d3-a456-426614174030",
            questionId,
            position: 0,
            points: 2.5,
            required: true,
            timeLimitSeconds: 30,
            question: {
                prompt: question.prompt,
                questionType: question.questionType,
                answerConfig: question.answerConfig,
                gradingConfig: question.gradingConfig,
                explanation: question.explanation,
            },
        },
    ],
};
