import {
    quizDetailSchema,
    quizListResponseSchema,
    type QuizContent,
    type QuizDetail,
} from "@quiz-builder/contracts";

import { authenticatedRequest } from "./client";

const body = (value: unknown) => JSON.stringify(value);

export async function listQuizzes(options: { tag?: string; scope?: "mine"; offset: number }) {
    const query = new URLSearchParams({ limit: "50", offset: String(options.offset) });
    if (options.tag) query.set("tag", options.tag);
    if (options.scope) query.set("scope", options.scope);
    return quizListResponseSchema.parse(
        await authenticatedRequest<unknown>(`/v1/quizzes?${query}`),
    );
}

export async function getQuiz(id: string): Promise<QuizDetail> {
    return quizDetailSchema.parse(await authenticatedRequest<unknown>(`/v1/quizzes/${id}`));
}

export async function createQuiz(input: { content: QuizContent }): Promise<QuizDetail> {
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
