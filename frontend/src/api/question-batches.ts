import {
    questionBatchListSchema,
    questionBatchSchema,
    type QuestionBatchArtifact,
} from "@quiz-builder/contracts";
import { authenticatedRequest } from "./client";

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
