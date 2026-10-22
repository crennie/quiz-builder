import {
    attemptDetailSchema,
    attemptListResponseSchema,
    type AttemptDetail,
    type UserResponse,
} from "@quiz-builder/contracts";

import { authenticatedRequest } from "./client";

export async function listAttempts(offset: number, lessonId?: string) {
    const query = new URLSearchParams({ limit: "20", offset: String(offset) });
    if (lessonId) query.set("lessonId", lessonId);
    return attemptListResponseSchema.parse(
        await authenticatedRequest<unknown>(`/v1/attempts?${query}`),
    );
}

export async function listLessonAttempts(lessonId: string): Promise<AttemptDetail[]> {
    const items: AttemptDetail[] = [];
    let offset: number | null = 0;
    do {
        const page = await listAttempts(offset, lessonId);
        items.push(...page.items);
        offset = page.nextOffset;
    } while (offset !== null);
    return items;
}

export async function getAttempt(id: string): Promise<AttemptDetail> {
    return attemptDetailSchema.parse(await authenticatedRequest<unknown>(`/v1/attempts/${id}`));
}

export async function startAttempt(quizId: string, lessonQuizId?: string): Promise<AttemptDetail> {
    return attemptDetailSchema.parse(
        await authenticatedRequest<unknown>(`/v1/quizzes/${quizId}/attempts`, {
            method: "POST",
            body: JSON.stringify({ lessonQuizId: lessonQuizId ?? null }),
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
