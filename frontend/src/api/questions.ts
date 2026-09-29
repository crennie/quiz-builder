import {
    questionDetailSchema,
    questionListResponseSchema,
    questionVersionsResponseSchema,
    tagListResponseSchema,
    tagSchema,
    type ContentStatus,
    type QuestionDetail,
    type QuestionVersionContent,
    type Tag,
    type Visibility,
} from "@quiz-builder/contracts";

import { authenticatedRequest } from "./client";

function body(value: unknown): string {
    return JSON.stringify(value);
}

export async function listQuestions(options: { tag?: string; offset: number }) {
    const query = new URLSearchParams({ limit: "50", offset: String(options.offset) });
    if (options.tag) query.set("tag", options.tag);
    return questionListResponseSchema.parse(
        await authenticatedRequest<unknown>(`/v1/questions?${query}`),
    );
}

export async function getQuestion(id: string): Promise<QuestionDetail> {
    return questionDetailSchema.parse(await authenticatedRequest<unknown>(`/v1/questions/${id}`));
}

export async function getQuestionVersions(id: string) {
    return questionVersionsResponseSchema.parse(
        await authenticatedRequest<unknown>(`/v1/questions/${id}/versions`),
    );
}

export async function createQuestion(input: {
    content: QuestionVersionContent;
    visibility: Visibility;
    status: "draft" | "published";
}): Promise<QuestionDetail> {
    return questionDetailSchema.parse(
        await authenticatedRequest<unknown>("/v1/questions", {
            method: "POST",
            body: body(input),
        }),
    );
}

export async function createQuestionVersion(
    id: string,
    content: QuestionVersionContent,
): Promise<QuestionDetail> {
    return questionDetailSchema.parse(
        await authenticatedRequest<unknown>(`/v1/questions/${id}/versions`, {
            method: "POST",
            body: body(content),
        }),
    );
}

export async function updateQuestionMetadata(
    id: string,
    value: {
        visibility?: Visibility;
        status?: ContentStatus;
    },
): Promise<QuestionDetail> {
    return questionDetailSchema.parse(
        await authenticatedRequest<unknown>(`/v1/questions/${id}`, {
            method: "PATCH",
            body: body(value),
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
