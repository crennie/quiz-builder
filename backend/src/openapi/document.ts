import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";
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
} from "@quiz-builder/contracts";
import type { z } from "zod";

import { currentUserResponseSchema } from "../api/schemas/current-user.ts";
import { errorResponseSchema } from "../api/schemas/error.ts";
import { healthResponseSchema } from "../api/schemas/health.ts";
import {
    questionListQuerySchema,
    questionParamsSchema,
    questionTagParamsSchema,
} from "../api/schemas/question-bank.ts";

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
            { name: "Tags", description: "User-scoped tag endpoints." },
        ],
    });
}
