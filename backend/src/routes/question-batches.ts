import {
    questionBatchArtifactSchema,
    questionBatchListSchema,
    questionBatchSchema,
} from "@quiz-builder/contracts";
import { Router, type Request } from "express";
import { z } from "zod";
import { validateRequest } from "../api/request.ts";
import { sendResponse } from "../api/response.ts";
import { requireAuthentication } from "../middleware/authentication.ts";
import {
    getQuestionBatch,
    ingestQuestionBatch,
    listQuestionBatches,
    materializeQuestionBatch,
} from "../db/question-batches.ts";

const batchParamsSchema = z.strictObject({ batchId: z.uuid() });
function actor(request: Request): string {
    if (!request.authenticatedUser?.id) throw new Error("Authenticated user was not set");
    return request.authenticatedUser.id;
}

export const questionBatchRouter = Router();
questionBatchRouter.post("/question-batches", requireAuthentication, async (request, response) => {
    const { body } = validateRequest(request, { body: questionBatchArtifactSchema });
    sendResponse(
        response,
        201,
        questionBatchSchema,
        await ingestQuestionBatch(actor(request), body),
    );
});
questionBatchRouter.get("/question-batches", requireAuthentication, async (request, response) => {
    sendResponse(response, 200, questionBatchListSchema, await listQuestionBatches(actor(request)));
});
questionBatchRouter.get(
    "/question-batches/:batchId",
    requireAuthentication,
    async (request, response) => {
        const { params } = validateRequest(request, { params: batchParamsSchema });
        sendResponse(
            response,
            200,
            questionBatchSchema,
            await getQuestionBatch(params.batchId, actor(request)),
        );
    },
);
questionBatchRouter.post(
    "/question-batches/:batchId/materialize",
    requireAuthentication,
    async (request, response) => {
        const { params } = validateRequest(request, {
            params: batchParamsSchema,
            body: z.strictObject({}),
        });
        sendResponse(
            response,
            200,
            questionBatchSchema,
            await materializeQuestionBatch(params.batchId, actor(request)),
        );
    },
);
