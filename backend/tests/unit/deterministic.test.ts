import { describe, expect, it } from "vitest";

import { evaluateAnswer } from "../../src/evaluation/deterministic.ts";

const questionId = "123e4567-e89b-42d3-a456-426614174010";
const questionVersionId = "223e4567-e89b-42d3-a456-426614174010";

describe("deterministic evaluation", () => {
    it("honors text case and whitespace settings", () => {
        const snapshots = {
            question: {
                questionId,
                questionVersionId,
                prompt: "Answer",
                questionType: "exact_text",
                explanation: null,
            },
            answer: { questionType: "exact_text", acceptedAnswers: ["Paris"] },
            grading: { questionType: "exact_text", caseSensitive: true, trimWhitespace: false },
        };
        expect(
            evaluateAnswer(snapshots, { questionType: "exact_text", text: " paris " }, 2.5),
        ).toMatchObject({ isCorrect: false, pointsAwarded: 0 });
        expect(
            evaluateAnswer(
                {
                    ...snapshots,
                    grading: {
                        ...snapshots.grading,
                        caseSensitive: false,
                        trimWhitespace: true,
                    },
                },
                { questionType: "exact_text", text: " paris " },
                2.5,
            ),
        ).toMatchObject({ isCorrect: true, pointsAwarded: 2.5 });
    });

    it("awards multi-choice points only for the exact set", () => {
        const snapshots = {
            question: {
                questionId,
                questionVersionId,
                prompt: "Choose",
                questionType: "multiple_choice_multi",
                explanation: null,
            },
            answer: {
                questionType: "multiple_choice_multi",
                options: [
                    { id: "a", text: "A" },
                    { id: "b", text: "B" },
                    { id: "c", text: "C" },
                ],
                correctOptionIds: ["a", "c"],
            },
            grading: { questionType: "multiple_choice_multi" },
        };
        expect(
            evaluateAnswer(
                snapshots,
                { questionType: "multiple_choice_multi", optionIds: ["a"] },
                0.25,
            ),
        ).toMatchObject({ isCorrect: false, pointsAwarded: 0 });
        expect(
            evaluateAnswer(
                snapshots,
                { questionType: "multiple_choice_multi", optionIds: ["c", "a"] },
                0.25,
            ),
        ).toMatchObject({ isCorrect: true, pointsAwarded: 0.25 });
    });
});
