import {
    claimWorkItemBodySchema,
    decideWorkItemBodySchema,
    failWorkItemBodySchema,
    requestAgentQuestionBodySchema,
    submitQuestionReviewBodySchema,
    workItemListResponseSchema,
    workItemSchema,
} from "@quiz-builder/contracts";
import { Router, type Request } from "express";
import { z } from "zod";
import { validateRequest } from "../api/request.ts";
import { sendResponse } from "../api/response.ts";
import { questionParamsSchema } from "../api/schemas/question-bank.ts";
import {
    cancelWorkItem,
    claimWorkItem,
    decideWorkItem,
    failWorkItem,
    handOffFailedAgentItem,
    listWorkItems,
    submitQuestionReview,
} from "../db/content-workflow.ts";
import { requireAuthentication } from "../middleware/authentication.ts";
import { enqueueAgentQuestion } from "../agent/creation.ts";

const itemParamsSchema = z.strictObject({ itemId: z.uuid() });
function actor(request: Request): string {
    if (!request.authenticatedUser?.id) throw new Error("Authenticated user was not set");
    return request.authenticatedUser.id;
}

export const contentWorkflowRouter = Router();
contentWorkflowRouter.post("/agent-questions", requireAuthentication, async (request, response) => {
    const { body } = validateRequest(request, { body: requestAgentQuestionBodySchema });
    sendResponse(response, 202, workItemSchema, await enqueueAgentQuestion(actor(request), body));
});
contentWorkflowRouter.post(
    "/questions/:questionId/review-submissions",
    requireAuthentication,
    async (request, response) => {
        const { params, body } = validateRequest(request, {
            params: questionParamsSchema,
            body: submitQuestionReviewBodySchema,
        });
        sendResponse(
            response,
            201,
            workItemSchema,
            await submitQuestionReview(params.questionId, body.versionId, actor(request)),
        );
    },
);
contentWorkflowRouter.get("/work-items", requireAuthentication, async (request, response) => {
    sendResponse(response, 200, workItemListResponseSchema, await listWorkItems(actor(request)));
});
contentWorkflowRouter.post(
    "/work-items/:itemId/claim",
    requireAuthentication,
    async (request, response) => {
        const { params } = validateRequest(request, {
            params: itemParamsSchema,
            body: claimWorkItemBodySchema,
        });
        sendResponse(
            response,
            200,
            workItemSchema,
            await claimWorkItem(params.itemId, actor(request)),
        );
    },
);
contentWorkflowRouter.post(
    "/work-items/:itemId/decision",
    requireAuthentication,
    async (request, response) => {
        const { params, body } = validateRequest(request, {
            params: itemParamsSchema,
            body: decideWorkItemBodySchema,
        });
        sendResponse(
            response,
            200,
            workItemSchema,
            await decideWorkItem(
                params.itemId,
                actor(request),
                body.claimToken,
                body.decision,
                body.findings,
            ),
        );
    },
);
contentWorkflowRouter.post(
    "/work-items/:itemId/fail",
    requireAuthentication,
    async (request, response) => {
        const { params, body } = validateRequest(request, {
            params: itemParamsSchema,
            body: failWorkItemBodySchema,
        });
        sendResponse(
            response,
            200,
            workItemSchema,
            await failWorkItem(params.itemId, actor(request), body.claimToken, body.reason),
        );
    },
);
contentWorkflowRouter.post(
    "/work-items/:itemId/hand-off",
    requireAuthentication,
    async (request, response) => {
        const { params } = validateRequest(request, {
            params: itemParamsSchema,
            body: claimWorkItemBodySchema,
        });
        sendResponse(
            response,
            200,
            workItemSchema,
            await handOffFailedAgentItem(params.itemId, actor(request)),
        );
    },
);
contentWorkflowRouter.post(
    "/work-items/:itemId/cancel",
    requireAuthentication,
    async (request, response) => {
        const { params } = validateRequest(request, {
            params: itemParamsSchema,
            body: claimWorkItemBodySchema,
        });
        sendResponse(
            response,
            200,
            workItemSchema,
            await cancelWorkItem(params.itemId, actor(request)),
        );
    },
);
