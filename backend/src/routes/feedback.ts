import {
    createFeedbackBodySchema,
    feedbackListResponseSchema,
    feedbackSchema,
    updateFeedbackStatusBodySchema,
} from "@quiz-builder/contracts";
import { Router, type Request } from "express";

import { validateRequest } from "../api/request.ts";
import { sendResponse } from "../api/response.ts";
import { feedbackListQuerySchema, feedbackParamsSchema } from "../api/schemas/feedback.ts";
import { createFeedback, listReceivedFeedback, updateFeedbackStatus } from "../db/feedback.ts";
import { requireAuthentication } from "../middleware/authentication.ts";

function userId(request: Request): string {
    const id = request.authenticatedUser?.id;
    if (!id) throw new Error("Authenticated user was not set by middleware");
    return id;
}

export const feedbackRouter = Router();

feedbackRouter.post("/feedback", requireAuthentication, async (request, response) => {
    const { body } = validateRequest(request, { body: createFeedbackBodySchema });
    sendResponse(response, 201, feedbackSchema, await createFeedback(userId(request), body));
});

feedbackRouter.get("/feedback/received", requireAuthentication, async (request, response) => {
    const { query } = validateRequest(request, { query: feedbackListQuerySchema });
    sendResponse(
        response,
        200,
        feedbackListResponseSchema,
        await listReceivedFeedback(userId(request), query),
    );
});

feedbackRouter.patch("/feedback/:feedbackId", requireAuthentication, async (request, response) => {
    const { params, body } = validateRequest(request, {
        params: feedbackParamsSchema,
        body: updateFeedbackStatusBodySchema,
    });
    sendResponse(
        response,
        200,
        feedbackSchema,
        await updateFeedbackStatus(params.feedbackId, userId(request), body.status),
    );
});
