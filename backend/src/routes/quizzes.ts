import {
    createQuizBodySchema,
    quizContentSchema,
    quizDetailSchema,
    quizListResponseSchema,
    quizVersionsResponseSchema,
    updateQuizMetadataBodySchema,
    type QuizDetail,
} from "@quiz-builder/contracts";
import { Router, type Request, type Response } from "express";

import { validateRequest } from "../api/request.ts";
import { sendResponse } from "../api/response.ts";
import {
    quizListQuerySchema,
    quizParamsSchema,
    quizTagParamsSchema,
} from "../api/schemas/quizzes.ts";
import {
    assignQuizTag,
    createQuiz,
    getQuizDetail,
    getQuizVersions,
    listQuizzes,
    removeQuizTag,
    saveQuizContent,
    updateQuizMetadata,
} from "../db/quizzes.ts";
import { AppError } from "../errors/app-error.ts";
import { optionalAuthentication, requireAuthentication } from "../middleware/authentication.ts";

function userId(request: Request): string {
    const id = request.authenticatedUser?.id;
    if (!id) throw new Error("Authenticated user was not set by middleware");
    return id;
}

export const quizRouter = Router();

quizRouter.get("/quizzes", optionalAuthentication, async (request, response) => {
    const { query } = validateRequest(request, { query: quizListQuerySchema });
    if (query.scope === "mine" && !request.authenticatedUser) {
        throw new AppError(401, "UNAUTHORIZED", "A valid access token is required");
    }
    const result = await listQuizzes({
        viewerId: request.authenticatedUser?.id ?? null,
        scope: query.scope,
        tagSlug: query.tag,
        limit: query.limit,
        offset: query.offset,
    });
    sendResponse(response, 200, quizListResponseSchema, result);
});

quizRouter.get("/quizzes/:quizId", optionalAuthentication, async (request, response) => {
    const { params } = validateRequest(request, { params: quizParamsSchema });
    const quiz = await getQuizDetail(params.quizId, request.authenticatedUser?.id ?? null);
    if (!quiz) throw new AppError(404, "QUIZ_NOT_FOUND", "Quiz not found");
    sendResponse(response, 200, quizDetailSchema, quiz);
});

quizRouter.post(
    "/quizzes",
    requireAuthentication,
    async (request, response: Response<QuizDetail>) => {
        const { body } = validateRequest(request, { body: createQuizBodySchema });
        const quiz = await createQuiz(userId(request), body);
        sendResponse(response, 201, quizDetailSchema, quiz);
    },
);

quizRouter.get("/quizzes/:quizId/versions", requireAuthentication, async (request, response) => {
    const { params } = validateRequest(request, { params: quizParamsSchema });
    const versions = await getQuizVersions(params.quizId, userId(request));
    sendResponse(response, 200, quizVersionsResponseSchema, { versions });
});

quizRouter.put(
    "/quizzes/:quizId/content",
    requireAuthentication,
    async (request, response: Response<QuizDetail>) => {
        const { params, body } = validateRequest(request, {
            params: quizParamsSchema,
            body: quizContentSchema,
        });
        const quiz = await saveQuizContent(params.quizId, userId(request), body);
        sendResponse(response, 200, quizDetailSchema, quiz);
    },
);

quizRouter.patch(
    "/quizzes/:quizId",
    requireAuthentication,
    async (request, response: Response<QuizDetail>) => {
        const { params, body } = validateRequest(request, {
            params: quizParamsSchema,
            body: updateQuizMetadataBodySchema,
        });
        const quiz = await updateQuizMetadata(params.quizId, userId(request), body);
        sendResponse(response, 200, quizDetailSchema, quiz);
    },
);

quizRouter.post(
    "/quizzes/:quizId/publish",
    requireAuthentication,
    async (request, response: Response<QuizDetail>) => {
        const { params } = validateRequest(request, { params: quizParamsSchema });
        const quiz = await updateQuizMetadata(params.quizId, userId(request), {
            status: "published",
        });
        sendResponse(response, 200, quizDetailSchema, quiz);
    },
);

quizRouter.post(
    "/quizzes/:quizId/archive",
    requireAuthentication,
    async (request, response: Response<QuizDetail>) => {
        const { params } = validateRequest(request, { params: quizParamsSchema });
        const quiz = await updateQuizMetadata(params.quizId, userId(request), {
            status: "archived",
        });
        sendResponse(response, 200, quizDetailSchema, quiz);
    },
);

quizRouter.put(
    "/quizzes/:quizId/tags/:tagId",
    requireAuthentication,
    async (request, response: Response<QuizDetail>) => {
        const { params } = validateRequest(request, { params: quizTagParamsSchema });
        const quiz = await assignQuizTag(params.quizId, params.tagId, userId(request));
        sendResponse(response, 200, quizDetailSchema, quiz);
    },
);

quizRouter.delete(
    "/quizzes/:quizId/tags/:tagId",
    requireAuthentication,
    async (request, response) => {
        const { params } = validateRequest(request, { params: quizTagParamsSchema });
        await removeQuizTag(params.quizId, params.tagId, userId(request));
        response.status(204).send();
    },
);
