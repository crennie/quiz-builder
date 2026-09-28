import {
    createQuestionBodySchema,
    createTagBodySchema,
    questionDetailSchema,
    questionListResponseSchema,
    questionVersionContentSchema,
    questionVersionsResponseSchema,
    tagListResponseSchema,
    tagSchema,
    updateQuestionMetadataBodySchema,
    type QuestionDetail,
    type Tag,
} from "@quiz-builder/contracts";
import { Router, type Request, type Response } from "express";

import { validateRequest } from "../api/request.ts";
import { sendResponse } from "../api/response.ts";
import {
    questionListQuerySchema,
    questionParamsSchema,
    questionTagParamsSchema,
} from "../api/schemas/question-bank.ts";
import {
    assignQuestionTag,
    createQuestion,
    createQuestionVersion,
    createTag,
    getQuestionDetail,
    getQuestionVersions,
    listQuestions,
    listTags,
    removeQuestionTag,
    updateQuestionMetadata,
} from "../db/question-bank.ts";
import { AppError } from "../errors/app-error.ts";
import { optionalAuthentication, requireAuthentication } from "../middleware/authentication.ts";

function authenticatedUserId(request: Request): string {
    const id = request.authenticatedUser?.id;
    if (!id) throw new Error("Authenticated user was not set by middleware");
    return id;
}

export const questionBankRouter = Router();

questionBankRouter.get("/questions", optionalAuthentication, async (request, response) => {
    const { query } = validateRequest(request, { query: questionListQuerySchema });
    const result = await listQuestions({
        viewerId: request.authenticatedUser?.id ?? null,
        tagSlug: query.tag,
        limit: query.limit,
        offset: query.offset,
    });
    sendResponse(response, 200, questionListResponseSchema, result);
});

questionBankRouter.get(
    "/questions/:questionId",
    optionalAuthentication,
    async (request, response) => {
        const { params } = validateRequest(request, { params: questionParamsSchema });
        const question = await getQuestionDetail(
            params.questionId,
            request.authenticatedUser?.id ?? null,
        );
        if (!question) throw new AppError(404, "QUESTION_NOT_FOUND", "Question not found");
        sendResponse(response, 200, questionDetailSchema, question);
    },
);

questionBankRouter.post(
    "/questions",
    requireAuthentication,
    async (request, response: Response<QuestionDetail>) => {
        const { body } = validateRequest(request, { body: createQuestionBodySchema });
        const question = await createQuestion(authenticatedUserId(request), body);
        sendResponse(response, 201, questionDetailSchema, question);
    },
);

questionBankRouter.get(
    "/questions/:questionId/versions",
    requireAuthentication,
    async (request, response) => {
        const { params } = validateRequest(request, { params: questionParamsSchema });
        const versions = await getQuestionVersions(params.questionId, authenticatedUserId(request));
        sendResponse(response, 200, questionVersionsResponseSchema, { versions });
    },
);

questionBankRouter.post(
    "/questions/:questionId/versions",
    requireAuthentication,
    async (request, response: Response<QuestionDetail>) => {
        const { params, body } = validateRequest(request, {
            params: questionParamsSchema,
            body: questionVersionContentSchema,
        });
        const question = await createQuestionVersion(
            params.questionId,
            authenticatedUserId(request),
            body,
        );
        sendResponse(response, 201, questionDetailSchema, question);
    },
);

questionBankRouter.patch(
    "/questions/:questionId",
    requireAuthentication,
    async (request, response: Response<QuestionDetail>) => {
        const { params, body } = validateRequest(request, {
            params: questionParamsSchema,
            body: updateQuestionMetadataBodySchema,
        });
        const question = await updateQuestionMetadata(
            params.questionId,
            authenticatedUserId(request),
            body,
        );
        sendResponse(response, 200, questionDetailSchema, question);
    },
);

questionBankRouter.post(
    "/questions/:questionId/archive",
    requireAuthentication,
    async (request, response: Response<QuestionDetail>) => {
        const { params } = validateRequest(request, { params: questionParamsSchema });
        const question = await updateQuestionMetadata(
            params.questionId,
            authenticatedUserId(request),
            {
                status: "archived",
            },
        );
        sendResponse(response, 200, questionDetailSchema, question);
    },
);

questionBankRouter.put(
    "/questions/:questionId/tags/:tagId",
    requireAuthentication,
    async (request, response: Response<QuestionDetail>) => {
        const { params } = validateRequest(request, { params: questionTagParamsSchema });
        const question = await assignQuestionTag(
            params.questionId,
            params.tagId,
            authenticatedUserId(request),
        );
        sendResponse(response, 200, questionDetailSchema, question);
    },
);

questionBankRouter.delete(
    "/questions/:questionId/tags/:tagId",
    requireAuthentication,
    async (request, response) => {
        const { params } = validateRequest(request, { params: questionTagParamsSchema });
        await removeQuestionTag(params.questionId, params.tagId, authenticatedUserId(request));
        response.status(204).send();
    },
);

questionBankRouter.get("/tags", requireAuthentication, async (request, response) => {
    const tags = await listTags(authenticatedUserId(request));
    sendResponse(response, 200, tagListResponseSchema, { tags });
});

questionBankRouter.post(
    "/tags",
    requireAuthentication,
    async (request, response: Response<Tag>) => {
        const { body } = validateRequest(request, { body: createTagBodySchema });
        const tag = await createTag(authenticatedUserId(request), body.name);
        sendResponse(response, 201, tagSchema, tag);
    },
);
