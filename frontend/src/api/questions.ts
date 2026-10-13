import {
    questionDetailSchema,
    questionListResponseSchema,
    tagListResponseSchema,
    tagSchema,
    type QuestionDetail,
    type QuestionContent,
    type Tag,
} from "@quiz-builder/contracts";

import { authenticatedRequest } from "./client";

function body(value: unknown): string {
    return JSON.stringify(value);
}

export async function listManagedQuestions(options: { tag?: string; offset: number }) {
    const query = new URLSearchParams({ limit: "50", offset: String(options.offset) });
    if (options.tag) query.set("tag", options.tag);
    return questionListResponseSchema.parse(
        await authenticatedRequest<unknown>(`/v1/questions/mine?${query}`),
    );
}

export async function getQuestion(id: string): Promise<QuestionDetail> {
    return questionDetailSchema.parse(await authenticatedRequest<unknown>(`/v1/questions/${id}`));
}
export async function createQuestion(input: { content: QuestionContent }): Promise<QuestionDetail> {
    return questionDetailSchema.parse(
        await authenticatedRequest<unknown>("/v1/questions", { method: "POST", body: body(input) }),
    );
}
export async function saveQuestionContent(
    id: string,
    content: QuestionContent,
): Promise<QuestionDetail> {
    return questionDetailSchema.parse(
        await authenticatedRequest<unknown>(`/v1/questions/${id}/content`, {
            method: "PUT",
            body: body(content),
        }),
    );
}

export async function listTags(): Promise<Tag[]> {
    return tagListResponseSchema.parse(await authenticatedRequest<unknown>("/v1/tags")).tags;
}

export async function createTag(name: string): Promise<Tag> {
    return tagSchema.parse(
        await authenticatedRequest<unknown>("/v1/tags", {
            method: "POST",
            body: body({ name }),
        }),
    );
}

export async function assignQuestionTag(
    questionId: string,
    tagId: string,
): Promise<QuestionDetail> {
    return questionDetailSchema.parse(
        await authenticatedRequest<unknown>(`/v1/questions/${questionId}/tags/${tagId}`, {
            method: "PUT",
        }),
    );
}

export async function removeQuestionTag(questionId: string, tagId: string): Promise<void> {
    await authenticatedRequest(`/v1/questions/${questionId}/tags/${tagId}`, { method: "DELETE" });
}
