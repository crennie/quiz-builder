import {
    questionBatchListSchema,
    questionBatchSchema,
    workItemListResponseSchema,
    workItemSchema,
    type QuestionBatchArtifact,
    type WorkItem,
} from "@quiz-builder/contracts";
import { authenticatedRequest } from "./client";

export async function requestAgentQuestion(brief: string, requestKey: string) {
    return workItemSchema.parse(
        await authenticatedRequest<unknown>("/v1/agent-questions", {
            method: "POST",
            body: JSON.stringify({ brief, requestKey }),
        }),
    );
}

export async function ingestQuestionBatch(artifact: QuestionBatchArtifact) {
    return questionBatchSchema.parse(
        await authenticatedRequest<unknown>("/v1/question-batches", {
            method: "POST",
            body: JSON.stringify(artifact),
        }),
    );
}

export async function listQuestionBatches() {
    return questionBatchListSchema.parse(
        await authenticatedRequest<unknown>("/v1/question-batches"),
    );
}

export async function getQuestionBatch(id: string) {
    return questionBatchSchema.parse(
        await authenticatedRequest<unknown>(`/v1/question-batches/${id}`),
    );
}

export async function materializeQuestionBatch(id: string) {
    return questionBatchSchema.parse(
        await authenticatedRequest<unknown>(`/v1/question-batches/${id}/materialize`, {
            method: "POST",
            body: "{}",
        }),
    );
}

export async function submitQuestionReview(questionId: string, versionId: string) {
    return workItemSchema.parse(
        await authenticatedRequest<unknown>(`/v1/questions/${questionId}/review-submissions`, {
            method: "POST",
            body: JSON.stringify({ versionId }),
        }),
    );
}
export async function listWorkItems() {
    return workItemListResponseSchema.parse(await authenticatedRequest<unknown>("/v1/work-items"));
}
export async function claimWorkItem(id: string) {
    return workItemSchema.parse(
        await authenticatedRequest<unknown>(`/v1/work-items/${id}/claim`, {
            method: "POST",
            body: "{}",
        }),
    );
}
export async function decideWorkItem(
    id: string,
    claimToken: string,
    decision: "approved" | "approve_and_publish" | "changes_requested" | "rejected",
    findings: string,
) {
    return workItemSchema.parse(
        await authenticatedRequest<unknown>(`/v1/work-items/${id}/decision`, {
            method: "POST",
            body: JSON.stringify({ claimToken, decision, findings }),
        }),
    );
}
export async function failWorkItem(id: string, claimToken: string, reason: string) {
    return workItemSchema.parse(
        await authenticatedRequest<unknown>(`/v1/work-items/${id}/fail`, {
            method: "POST",
            body: JSON.stringify({ claimToken, reason }),
        }),
    );
}
export async function cancelWorkItem(id: string): Promise<WorkItem> {
    return workItemSchema.parse(
        await authenticatedRequest<unknown>(`/v1/work-items/${id}/cancel`, {
            method: "POST",
            body: "{}",
        }),
    );
}
export async function handOffFailedAgentItem(id: string): Promise<WorkItem> {
    return workItemSchema.parse(
        await authenticatedRequest<unknown>(`/v1/work-items/${id}/hand-off`, {
            method: "POST",
            body: "{}",
        }),
    );
}
