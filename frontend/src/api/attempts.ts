import {
    attemptDetailSchema,
    attemptListResponseSchema,
    type AttemptDetail,
    type UserResponse,
} from "@quiz-builder/contracts";

import { authenticatedRequest } from "./client";

export async function listAttempts(offset: number) {
    const query = new URLSearchParams({ limit: "20", offset: String(offset) });
    return attemptListResponseSchema.parse(
        await authenticatedRequest<unknown>(`/v1/attempts?${query}`),
    );
}

export async function getAttempt(id: string): Promise<AttemptDetail> {
    return attemptDetailSchema.parse(await authenticatedRequest<unknown>(`/v1/attempts/${id}`));
}

export async function startAttempt(quizId: string): Promise<AttemptDetail> {
    return attemptDetailSchema.parse(
        await authenticatedRequest<unknown>(`/v1/quizzes/${quizId}/attempts`, {
            method: "POST",
        }),
    );
}

export async function submitAnswer(
    attemptId: string,
    questionId: string,
    response: UserResponse,
): Promise<AttemptDetail> {
    return attemptDetailSchema.parse(
        await authenticatedRequest<unknown>(
            `/v1/attempts/${attemptId}/questions/${questionId}/answer`,
            {
                method: "PUT",
                body: JSON.stringify({ response }),
            },
        ),
    );
}

export async function completeAttempt(id: string): Promise<AttemptDetail> {
    return attemptDetailSchema.parse(
        await authenticatedRequest<unknown>(`/v1/attempts/${id}/complete`, {
            method: "POST",
        }),
    );
}
