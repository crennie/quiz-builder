import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
import {
    attemptDetailSchema,
    attemptListResponseSchema,
    createFeedbackBodySchema,
    createQuestionBodySchema,
    createQuizBodySchema,
    createTagBodySchema,
    feedbackListResponseSchema,
    feedbackSchema,
    questionDetailSchema,
    questionListResponseSchema,
    questionVersionContentSchema,
    questionVersionsResponseSchema,
    quizContentSchema,
    quizDetailSchema,
    quizListResponseSchema,
    quizVersionsResponseSchema,
    tagListResponseSchema,
    tagSchema,
    submitAnswerBodySchema,
    updateQuestionMetadataBodySchema,
    updateQuizMetadataBodySchema,
    updateFeedbackStatusBodySchema,
} from "@quiz-builder/contracts";
import type { z } from "zod";

import { currentUserResponseSchema } from "../api/schemas/current-user.ts";
import {
    attemptListQuerySchema,
    attemptParamsSchema,
    attemptQuestionParamsSchema,
} from "../api/schemas/attempts.ts";
import { errorResponseSchema } from "../api/schemas/error.ts";
import { feedbackListQuerySchema, feedbackParamsSchema } from "../api/schemas/feedback.ts";
import { healthResponseSchema } from "../api/schemas/health.ts";
import {
    questionListQuerySchema,
    questionParamsSchema,
    questionTagParamsSchema,
} from "../api/schemas/question-bank.ts";
import {
    quizListQuerySchema,
    quizParamsSchema,
    quizTagParamsSchema,
} from "../api/schemas/quizzes.ts";

// The shared package and backend have separate Zod installations. Their runtime schemas are
// compatible, but the OpenAPI package augments only the backend copy's TypeScript interface.
function apiSchema(schema: unknown): z.ZodType {
    return schema as z.ZodType;
}

const registry = new OpenAPIRegistry();

registry.registerComponent("securitySchemes", "BearerAuth", {
    type: "http",
    scheme: "bearer",
    bearerFormat: "JWT",
    description: "Supabase Auth user access token.",
});

const errorContent = {
    "application/json": {
        schema: errorResponseSchema,
    },
};

const questionContent = {
    "application/json": { schema: apiSchema(questionDetailSchema) },
};
const quizContent = { "application/json": { schema: apiSchema(quizDetailSchema) } };
const tagContent = {
    "application/json": { schema: apiSchema(tagSchema) },
};
const commonErrors = {
    400: { description: "Invalid request.", content: errorContent },
    401: { description: "A valid access token is required.", content: errorContent },
    404: { description: "Resource not found or not accessible.", content: errorContent },
    409: { description: "Conflicting resource state.", content: errorContent },
    503: { description: "Supabase Auth is unavailable.", content: errorContent },
    500: { description: "An unexpected server error occurred.", content: errorContent },
};

registry.registerPath({
    method: "get",
    path: "/health",
    tags: ["Operations"],
    summary: "Check service health",
    responses: {
        200: {
            description: "The service is healthy.",
            content: {
                "application/json": {
                    schema: healthResponseSchema,
                },
            },
        },
        500: {
            description: "An unexpected server error occurred.",
            content: errorContent,
        },
    },
});

registry.registerPath({
    method: "get",
    path: "/api/v1/questions",
    tags: ["Questions"],
    summary: "List discoverable and owned questions",
    request: { query: questionListQuerySchema },
    responses: {
        200: {
            description: "Questions and pagination offset.",
            content: { "application/json": { schema: apiSchema(questionListResponseSchema) } },
        },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "get",
    path: "/api/v1/questions/{questionId}",
    tags: ["Questions"],
    summary: "Get an accessible question and its current version",
    request: { params: questionParamsSchema },
    responses: {
        200: { description: "Question detail.", content: questionContent },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "post",
    path: "/api/v1/questions",
    tags: ["Questions"],
    summary: "Create a question and its first immutable version",
    security: [{ BearerAuth: [] }],
    request: {
        body: { content: { "application/json": { schema: apiSchema(createQuestionBodySchema) } } },
    },
    responses: {
        201: { description: "Created question.", content: questionContent },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "get",
    path: "/api/v1/questions/{questionId}/versions",
    tags: ["Questions"],
    summary: "List an owned question's immutable versions",
    security: [{ BearerAuth: [] }],
    request: { params: questionParamsSchema },
    responses: {
        200: {
            description: "Question versions, newest first.",
            content: { "application/json": { schema: apiSchema(questionVersionsResponseSchema) } },
        },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "post",
    path: "/api/v1/questions/{questionId}/versions",
    tags: ["Questions"],
    summary: "Create the next immutable question version",
    security: [{ BearerAuth: [] }],
    request: {
        params: questionParamsSchema,
        body: {
            content: { "application/json": { schema: apiSchema(questionVersionContentSchema) } },
        },
    },
    responses: {
        201: { description: "Question with new current version.", content: questionContent },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "patch",
    path: "/api/v1/questions/{questionId}",
    tags: ["Questions"],
    summary: "Update question visibility or lifecycle without creating a version",
    security: [{ BearerAuth: [] }],
    request: {
        params: questionParamsSchema,
        body: {
            content: {
                "application/json": { schema: apiSchema(updateQuestionMetadataBodySchema) },
            },
        },
    },
    responses: {
        200: { description: "Updated question.", content: questionContent },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "post",
    path: "/api/v1/questions/{questionId}/archive",
    tags: ["Questions"],
    summary: "Archive a question",
    security: [{ BearerAuth: [] }],
    request: { params: questionParamsSchema },
    responses: {
        200: { description: "Archived question.", content: questionContent },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "put",
    path: "/api/v1/questions/{questionId}/tags/{tagId}",
    tags: ["Questions", "Tags"],
    summary: "Assign an owned tag to an owned question",
    security: [{ BearerAuth: [] }],
    request: { params: questionTagParamsSchema },
    responses: {
        200: { description: "Tagged question.", content: questionContent },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "delete",
    path: "/api/v1/questions/{questionId}/tags/{tagId}",
    tags: ["Questions", "Tags"],
    summary: "Remove an owned tag from an owned question",
    security: [{ BearerAuth: [] }],
    request: { params: questionTagParamsSchema },
    responses: {
        204: { description: "Tag assignment removed." },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "get",
    path: "/api/v1/tags",
    tags: ["Tags"],
    summary: "List the current user's tags",
    security: [{ BearerAuth: [] }],
    responses: {
        200: {
            description: "User-scoped tags.",
            content: { "application/json": { schema: apiSchema(tagListResponseSchema) } },
        },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "post",
    path: "/api/v1/tags",
    tags: ["Tags"],
    summary: "Create a user-scoped tag",
    security: [{ BearerAuth: [] }],
    request: {
        body: { content: { "application/json": { schema: apiSchema(createTagBodySchema) } } },
    },
    responses: {
        201: { description: "Created tag.", content: tagContent },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "get",
    path: "/api/v1/me",
    tags: ["Users"],
    summary: "Get the current user's profile",
    security: [{ BearerAuth: [] }],
    responses: {
        200: {
            description: "The authenticated user's application profile.",
            content: {
                "application/json": {
                    schema: currentUserResponseSchema,
                },
            },
        },
        401: {
            description: "A valid Supabase Auth access token is required.",
            content: errorContent,
        },
        503: {
            description: "Supabase Auth is temporarily unavailable.",
            content: errorContent,
        },
        500: {
            description: "An unexpected server error occurred.",
            content: errorContent,
        },
    },
});

registry.registerPath({
    method: "get",
    path: "/api/v1/quizzes",
    tags: ["Quizzes"],
    summary: "List discoverable and owned quizzes",
    request: { query: quizListQuerySchema },
    responses: {
        200: {
            description: "Quizzes and pagination offset.",
            content: {
                "application/json": { schema: apiSchema(quizListResponseSchema) },
            },
        },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "get",
    path: "/api/v1/quizzes/{quizId}",
    tags: ["Quizzes"],
    summary: "Get an accessible quiz with its exact question versions",
    request: { params: quizParamsSchema },
    responses: { 200: { description: "Quiz detail.", content: quizContent }, ...commonErrors },
});

registry.registerPath({
    method: "post",
    path: "/api/v1/quizzes",
    tags: ["Quizzes"],
    summary: "Create a quiz and its first immutable version",
    security: [{ BearerAuth: [] }],
    request: {
        body: { content: { "application/json": { schema: apiSchema(createQuizBodySchema) } } },
    },
    responses: { 201: { description: "Created quiz.", content: quizContent }, ...commonErrors },
});

registry.registerPath({
    method: "get",
    path: "/api/v1/quizzes/{quizId}/versions",
    tags: ["Quizzes"],
    summary: "List an owned quiz's immutable versions",
    security: [{ BearerAuth: [] }],
    request: { params: quizParamsSchema },
    responses: {
        200: {
            description: "Quiz versions, newest first.",
            content: {
                "application/json": { schema: apiSchema(quizVersionsResponseSchema) },
            },
        },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "put",
    path: "/api/v1/quizzes/{quizId}/content",
    tags: ["Quizzes"],
    summary: "Save attempt-relevant content; an equivalent save keeps the current version",
    security: [{ BearerAuth: [] }],
    request: {
        params: quizParamsSchema,
        body: {
            content: {
                "application/json": { schema: apiSchema(quizContentSchema) },
            },
        },
    },
    responses: {
        200: {
            description: "Current quiz, whether or not a new version was created.",
            content: quizContent,
        },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "patch",
    path: "/api/v1/quizzes/{quizId}",
    tags: ["Quizzes"],
    summary: "Update visibility or lifecycle without creating a content version",
    security: [{ BearerAuth: [] }],
    request: {
        params: quizParamsSchema,
        body: {
            content: {
                "application/json": { schema: apiSchema(updateQuizMetadataBodySchema) },
            },
        },
    },
    responses: { 200: { description: "Updated quiz.", content: quizContent }, ...commonErrors },
});

for (const action of ["publish", "archive"] as const) {
    registry.registerPath({
        method: "post",
        path: `/api/v1/quizzes/{quizId}/${action}`,
        tags: ["Quizzes"],
        summary: `${action === "publish" ? "Publish" : "Archive"} an owned quiz`,
        security: [{ BearerAuth: [] }],
        request: { params: quizParamsSchema },
        responses: { 200: { description: "Updated quiz.", content: quizContent }, ...commonErrors },
    });
}

registry.registerPath({
    method: "put",
    path: "/api/v1/quizzes/{quizId}/tags/{tagId}",
    tags: ["Quizzes", "Tags"],
    summary: "Assign an owned tag to an owned quiz",
    security: [{ BearerAuth: [] }],
    request: { params: quizTagParamsSchema },
    responses: { 200: { description: "Tagged quiz.", content: quizContent }, ...commonErrors },
});

registry.registerPath({
    method: "delete",
    path: "/api/v1/quizzes/{quizId}/tags/{tagId}",
    tags: ["Quizzes", "Tags"],
    summary: "Remove an owned tag from an owned quiz",
    security: [{ BearerAuth: [] }],
    request: { params: quizTagParamsSchema },
    responses: { 204: { description: "Tag assignment removed." }, ...commonErrors },
});

const attemptContent = { "application/json": { schema: apiSchema(attemptDetailSchema) } };

registry.registerPath({
    method: "post",
    path: "/api/v1/quizzes/{quizId}/attempts",
    tags: ["Attempts"],
    summary: "Start an attempt from the current published quiz version",
    security: [{ BearerAuth: [] }],
    request: { params: quizParamsSchema },
    responses: {
        201: { description: "Started attempt with question snapshots.", content: attemptContent },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "get",
    path: "/api/v1/attempts",
    tags: ["Attempts"],
    summary: "List the current user's attempt history",
    security: [{ BearerAuth: [] }],
    request: { query: attemptListQuerySchema },
    responses: {
        200: {
            description: "Attempts and pagination offset.",
            content: {
                "application/json": { schema: apiSchema(attemptListResponseSchema) },
            },
        },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "get",
    path: "/api/v1/attempts/{attemptId}",
    tags: ["Attempts"],
    summary: "Load an owned attempt or its historical results",
    security: [{ BearerAuth: [] }],
    request: { params: attemptParamsSchema },
    responses: {
        200: { description: "Attempt detail.", content: attemptContent },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "put",
    path: "/api/v1/attempts/{attemptId}/questions/{questionId}/answer",
    tags: ["Attempts"],
    summary: "Submit and evaluate one answer",
    security: [{ BearerAuth: [] }],
    request: {
        params: attemptQuestionParamsSchema,
        body: {
            content: { "application/json": { schema: apiSchema(submitAnswerBodySchema) } },
        },
    },
    responses: {
        200: { description: "Updated attempt.", content: attemptContent },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "post",
    path: "/api/v1/attempts/{attemptId}/complete",
    tags: ["Attempts"],
    summary: "Complete an attempt and aggregate recorded results",
    security: [{ BearerAuth: [] }],
    request: { params: attemptParamsSchema },
    responses: {
        200: { description: "Completed attempt and results.", content: attemptContent },
        ...commonErrors,
    },
});

const feedbackContent = { "application/json": { schema: apiSchema(feedbackSchema) } };

registry.registerPath({
    method: "post",
    path: "/api/v1/feedback",
    tags: ["Feedback"],
    summary: "Submit feedback on one accessible question, quiz, or own attempt question",
    security: [{ BearerAuth: [] }],
    request: {
        body: { content: { "application/json": { schema: apiSchema(createFeedbackBodySchema) } } },
    },
    responses: {
        201: { description: "Created feedback.", content: feedbackContent },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "get",
    path: "/api/v1/feedback/received",
    tags: ["Feedback"],
    summary: "List feedback about the current user's questions and quizzes",
    security: [{ BearerAuth: [] }],
    request: { query: feedbackListQuerySchema },
    responses: {
        200: {
            description: "Received feedback and pagination offset.",
            content: {
                "application/json": { schema: apiSchema(feedbackListResponseSchema) },
            },
        },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "patch",
    path: "/api/v1/feedback/{feedbackId}",
    tags: ["Feedback"],
    summary: "Update the review status of feedback about owned content",
    security: [{ BearerAuth: [] }],
    request: {
        params: feedbackParamsSchema,
        body: {
            content: { "application/json": { schema: apiSchema(updateFeedbackStatusBodySchema) } },
        },
    },
    responses: {
        200: { description: "Updated feedback.", content: feedbackContent },
        ...commonErrors,
    },
});

export function createOpenApiDocument() {
    const generator = new OpenApiGeneratorV31(registry.definitions);

    return generator.generateDocument({
        openapi: "3.1.0",
        info: {
            title: "Quiz Builder API",
            version: "0.0.1",
            description: "API for creating and practicing question-based study content.",
        },
        tags: [
            { name: "Operations", description: "Service operational endpoints." },
            { name: "Users", description: "Authenticated user endpoints." },
            { name: "Questions", description: "Question bank endpoints." },
            { name: "Quizzes", description: "Quiz management endpoints." },
            { name: "Tags", description: "User-scoped tag endpoints." },
        ],
    });
}
