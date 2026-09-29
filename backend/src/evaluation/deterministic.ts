import {
    attemptQuestionSnapshotsSchema,
    evaluationResultSchema,
    userResponseSchema,
    type EvaluationResult,
    type UserResponse,
} from "@quiz-builder/contracts";

type Snapshots = ReturnType<typeof attemptQuestionSnapshotsSchema.parse>;
type Evaluator = (snapshots: Snapshots, response: UserResponse) => boolean;

const evaluators: Record<UserResponse["questionType"], Evaluator> = {
    exact_text(snapshots, response) {
        if (
            snapshots.answer.questionType !== "exact_text" ||
            snapshots.grading.questionType !== "exact_text" ||
            response.questionType !== "exact_text"
        )
            return false;
        const grading = snapshots.grading;
        const normalize = (text: string): string => {
            const trimmed = grading.trimWhitespace ? text.trim() : text;
            return grading.caseSensitive ? trimmed : trimmed.toLowerCase();
        };
        return snapshots.answer.acceptedAnswers.some(
            (answer) => normalize(answer) === normalize(response.text),
        );
    },
    multiple_choice_single(snapshots, response) {
        return (
            snapshots.answer.questionType === "multiple_choice_single" &&
            response.questionType === "multiple_choice_single" &&
            response.optionId === snapshots.answer.correctOptionId
        );
    },
    multiple_choice_multi(snapshots, response) {
        if (
            snapshots.answer.questionType !== "multiple_choice_multi" ||
            response.questionType !== "multiple_choice_multi"
        )
            return false;
        const correctIds = snapshots.answer.correctOptionIds;
        return (
            response.optionIds.length === correctIds.length &&
            response.optionIds.every((id) => correctIds.includes(id))
        );
    },
};

export function evaluateAnswer(
    rawSnapshots: unknown,
    rawResponse: unknown,
    pointsPossible: number,
): EvaluationResult {
    const snapshots = attemptQuestionSnapshotsSchema.parse(rawSnapshots);
    const response = userResponseSchema.parse(rawResponse);
    if (response.questionType !== snapshots.question.questionType) {
        throw new Error("Response question type does not match snapshot");
    }
    const isCorrect = evaluators[response.questionType](snapshots, response);
    return evaluationResultSchema.parse({
        isCorrect,
        pointsPossible,
        pointsAwarded: isCorrect ? pointsPossible : 0,
        explanation: snapshots.question.explanation,
    });
}
