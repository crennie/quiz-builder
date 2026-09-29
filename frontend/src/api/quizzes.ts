import {
    quizDetailSchema,
    quizListResponseSchema,
    quizVersionsResponseSchema,
    type ContentStatus,
    type QuizContent,
    type QuizDetail,
    type Visibility,
} from "@quiz-builder/contracts";

import { authenticatedRequest } from "./client";

const body = (value: unknown) => JSON.stringify(value);

export async function listQuizzes(options: { tag?: string; offset: number }) {
    const query = new URLSearchParams({ limit: "50", offset: String(options.offset) });
    if (options.tag) query.set("tag", options.tag);
    return quizListResponseSchema.parse(
        await authenticatedRequest<unknown>(`/v1/quizzes?${query}`),
    );
}

export async function getQuiz(id: string): Promise<QuizDetail> {
    return quizDetailSchema.parse(await authenticatedRequest<unknown>(`/v1/quizzes/${id}`));
}

export async function getQuizVersions(id: string) {
    return quizVersionsResponseSchema.parse(
        await authenticatedRequest<unknown>(`/v1/quizzes/${id}/versions`),
    );
}

export async function createQuiz(input: {
    content: QuizContent;
    visibility: Visibility;
    status: "draft" | "published";
}): Promise<QuizDetail> {
    return quizDetailSchema.parse(
        await authenticatedRequest<unknown>("/v1/quizzes", {
            method: "POST",
            body: body(input),
        }),
    );
}

export async function saveQuizContent(id: string, content: QuizContent): Promise<QuizDetail> {
    return quizDetailSchema.parse(
        await authenticatedRequest<unknown>(`/v1/quizzes/${id}/content`, {
            method: "PUT",
            body: body(content),
        }),
    );
}

export async function updateQuizMetadata(
    id: string,
    value: { visibility?: Visibility; status?: ContentStatus },
): Promise<QuizDetail> {
    return quizDetailSchema.parse(
        await authenticatedRequest<unknown>(`/v1/quizzes/${id}`, {
            method: "PATCH",
            body: body(value),
        }),
    );
}

export async function assignQuizTag(id: string, tagId: string): Promise<QuizDetail> {
    return quizDetailSchema.parse(
        await authenticatedRequest<unknown>(`/v1/quizzes/${id}/tags/${tagId}`, {
            method: "PUT",
        }),
    );
}

export async function removeQuizTag(id: string, tagId: string): Promise<void> {
    await authenticatedRequest(`/v1/quizzes/${id}/tags/${tagId}`, { method: "DELETE" });
}
