import {
    attemptDetailSchema,
    attemptListResponseSchema,
    submitAnswerBodySchema,
} from "@quiz-builder/contracts";
import { Router, type Request } from "express";

import { validateRequest } from "../api/request.ts";
import { sendResponse } from "../api/response.ts";
import {
    attemptListQuerySchema,
    attemptParamsSchema,
    attemptQuestionParamsSchema,
} from "../api/schemas/attempts.ts";
import { quizParamsSchema } from "../api/schemas/quizzes.ts";
import {
    completeAttempt,
    getAttempt,
    listAttempts,
    startAttempt,
    submitAnswer,
} from "../db/attempts.ts";
import { requireAuthentication } from "../middleware/authentication.ts";

function userId(request: Request): string {
    const id = request.authenticatedUser?.id;
    if (!id) throw new Error("Authenticated user was not set by middleware");
    return id;
}

export const attemptRouter = Router();

attemptRouter.post(
    "/quizzes/:quizId/attempts",
    requireAuthentication,
    async (request, response) => {
        const { params } = validateRequest(request, { params: quizParamsSchema });
        sendResponse(
            response,
            201,
            attemptDetailSchema,
            await startAttempt(params.quizId, userId(request)),
        );
    },
);

attemptRouter.get("/attempts", requireAuthentication, async (request, response) => {
    const { query } = validateRequest(request, { query: attemptListQuerySchema });
    sendResponse(
        response,
        200,
        attemptListResponseSchema,
        await listAttempts(userId(request), query),
    );
});

attemptRouter.get("/attempts/:attemptId", requireAuthentication, async (request, response) => {
    const { params } = validateRequest(request, { params: attemptParamsSchema });
    sendResponse(
        response,
        200,
        attemptDetailSchema,
        await getAttempt(params.attemptId, userId(request)),
    );
});

attemptRouter.put(
    "/attempts/:attemptId/questions/:questionId/answer",
    requireAuthentication,
    async (request, response) => {
        const { params, body } = validateRequest(request, {
            params: attemptQuestionParamsSchema,
            body: submitAnswerBodySchema,
        });
        sendResponse(
            response,
            200,
            attemptDetailSchema,
            await submitAnswer(params.attemptId, params.questionId, userId(request), body.response),
        );
    },
);

attemptRouter.post(
    "/attempts/:attemptId/complete",
    requireAuthentication,
    async (request, response) => {
        const { params } = validateRequest(request, { params: attemptParamsSchema });
        sendResponse(
            response,
            200,
            attemptDetailSchema,
            await completeAttempt(params.attemptId, userId(request)),
        );
    },
);
