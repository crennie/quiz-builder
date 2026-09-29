import {
    createFeedbackBodySchema,
    feedbackSchema,
    type CreateFeedbackBody,
    type Feedback,
} from "@quiz-builder/contracts";

import { authenticatedRequest } from "./client";

export async function createFeedback(input: CreateFeedbackBody): Promise<Feedback> {
    const body = createFeedbackBodySchema.parse(input);
    return feedbackSchema.parse(
        await authenticatedRequest<unknown>("/v1/feedback", {
            method: "POST",
            body: JSON.stringify(body),
        }),
    );
}
