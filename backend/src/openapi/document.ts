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
    questionContentSchema,
    courseSchema,
    courseImportBodySchema,
    lessonImportBodySchema,
    saveLessonBodySchema,
    courseImportResultSchema,
    startAttemptBodySchema,
    courseListResponseSchema,
    lessonDetailSchema,
    lessonListResponseSchema,
    lessonQuizListResponseSchema,
    questionBatchArtifactSchema,
    questionBatchListSchema,
    questionBatchSchema,
    quizContentSchema,
    quizDetailSchema,
    quizListResponseSchema,
    tagListResponseSchema,
    tagSchema,
    submitAnswerBodySchema,
    updateFeedbackStatusBodySchema,
} from "@quiz-builder/contracts";
import { z } from "zod";

import {
    courseParamsSchema,
    lessonParamsSchema,
    contentListQuerySchema,
} from "../api/schemas/courses.ts";
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
    quizArchiveBodySchema,
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
    413: { description: "Request body is too large.", content: errorContent },
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
    path: "/api/v1/questions/mine",
    tags: ["Questions"],
    summary: "List owned questions",
    security: [{ BearerAuth: [] }],
    request: { query: questionListQuerySchema },
    responses: {
        200: {
            description: "Owned questions and pagination offset.",
            content: { "application/json": { schema: apiSchema(questionListResponseSchema) } },
        },
        ...commonErrors,
    },
});

registry.registerPath({
    method: "get",
    path: "/api/v1/questions/{questionId}",
    tags: ["Questions"],
    summary: "Get an owned or public question",
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
    summary: "Create a private question",
    security: [{ BearerAuth: [] }],
    request: {
        body: { content: { "application/json": { schema: apiSchema(createQuestionBodySchema) } } },
    },
    responses: {
        201: { description: "Created question.", content: questionContent },
        ...commonErrors,
    },
});

const batchParamsSchema = z.strictObject({ batchId: z.uuid() });
const batchContent = { "application/json": { schema: apiSchema(questionBatchSchema) } };
registry.registerPath({
    method: "post",
    path: "/api/v1/question-batches",
    tags: ["Batches"],
    summary: "Validate and retain a question batch artifact",
    security: [{ BearerAuth: [] }],
    request: {
        body: {
            content: { "application/json": { schema: apiSchema(questionBatchArtifactSchema) } },
        },
    },
    responses: {
        201: { description: "Retained batch artifact.", content: batchContent },
        ...commonErrors,
    },
});
registry.registerPath({
    method: "get",
    path: "/api/v1/question-batches",
    tags: ["Batches"],
    summary: "List the sponsor's recent question batches",
    security: [{ BearerAuth: [] }],
    responses: {
        200: {
            description: "Recent batches.",
            content: { "application/json": { schema: apiSchema(questionBatchListSchema) } },
        },
        ...commonErrors,
    },
});
registry.registerPath({
    method: "get",
    path: "/api/v1/question-batches/{batchId}",
    tags: ["Batches"],
    summary: "Get an owned batch artifact and its materialized questions",
    security: [{ BearerAuth: [] }],
    request: { params: batchParamsSchema },
    responses: {
        200: { description: "Batch and question mappings.", content: batchContent },
        ...commonErrors,
    },
});
registry.registerPath({
    method: "post",
    path: "/api/v1/question-batches/{batchId}/materialize",
    tags: ["Batches"],
    summary: "Create usable private questions from a retained batch",
    security: [{ BearerAuth: [] }],
    request: {
        params: batchParamsSchema,
        body: { content: { "application/json": { schema: z.strictObject({}) } } },
    },
    responses: {
        200: { description: "Batch and question mappings.", content: batchContent },
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
    summary: "Get an owned or public quiz",
    request: { params: quizParamsSchema },
    responses: { 200: { description: "Quiz detail.", content: quizContent }, ...commonErrors },
});

registry.registerPath({
    method: "put",
    path: "/api/v1/quizzes/{quizId}/archive",
    tags: ["Quizzes"],
    summary: "Archive or restore an owned private quiz, preserving attempt history",
    security: [{ BearerAuth: [] }],
    request: {
        params: quizParamsSchema,
        body: { content: { "application/json": { schema: apiSchema(quizArchiveBodySchema) } } },
    },
    responses: { 200: { description: "Updated quiz.", content: quizContent }, ...commonErrors },
});

registry.registerPath({
    method: "post",
    path: "/api/v1/quizzes",
    tags: ["Quizzes"],
    summary: "Create a private quiz",
    security: [{ BearerAuth: [] }],
    request: {
        body: { content: { "application/json": { schema: apiSchema(createQuizBodySchema) } } },
    },
    responses: { 201: { description: "Created quiz.", content: quizContent }, ...commonErrors },
});

registry.registerPath({
    method: "put",
    path: "/api/v1/quizzes/{quizId}/content",
    tags: ["Quizzes"],
    summary: "Save unused private quiz content; equivalent saves are harmless",
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
            description: "Saved quiz.",
            content: quizContent,
        },
        ...commonErrors,
    },
});

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
    summary: "Start an attempt from an accessible quiz",
    security: [{ BearerAuth: [] }],
    request: {
        params: quizParamsSchema,
        body: {
            required: false,
            content: { "application/json": { schema: apiSchema(startAttemptBodySchema) } },
        },
    },
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
    summary: "Save or replace and evaluate an answer while the attempt is in progress",
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

registry.registerPath({
    method: "put",
    path: "/api/v1/questions/{questionId}/content",
    tags: ["Questions"],
    summary: "Save unused private question content",
    security: [{ BearerAuth: [] }],
    request: {
        params: questionParamsSchema,
        body: { content: { "application/json": { schema: apiSchema(questionContentSchema) } } },
    },
    responses: {
        200: { description: "Saved question.", content: questionContent },
        ...commonErrors,
    },
});
for (const [path, params, query, schema, summary] of [
    [
        "/api/v1/courses",
        undefined,
        contentListQuerySchema,
        courseListResponseSchema,
        "List public courses",
    ],
    [
        "/api/v1/courses/{courseId}",
        courseParamsSchema,
        undefined,
        courseSchema,
        "Get a public course",
    ],
    [
        "/api/v1/courses/{courseId}/lessons",
        courseParamsSchema,
        contentListQuerySchema,
        lessonListResponseSchema,
        "List ordered course lessons",
    ],
    [
        "/api/v1/lessons/{lessonId}",
        lessonParamsSchema,
        undefined,
        lessonDetailSchema,
        "Get a public lesson",
    ],
    [
        "/api/v1/lessons/{lessonId}/quizzes",
        lessonParamsSchema,
        contentListQuerySchema,
        lessonQuizListResponseSchema,
        "List ordered lesson quizzes",
    ],
] as const)
    registry.registerPath({
        method: "get",
        path,
        tags: ["Courses"],
        summary,
        request: { params, query },
        responses: {
            200: {
                description: summary,
                content: { "application/json": { schema: apiSchema(schema) } },
            },
            ...commonErrors,
        },
    });

for (const [path, params, schema, summary] of [
    [
        "/api/v1/courses/import",
        undefined,
        courseImportBodySchema,
        "Import a new public course and its ordered lessons",
    ],
    [
        "/api/v1/courses/{courseId}/lessons/import",
        courseParamsSchema,
        lessonImportBodySchema,
        "Append public lessons to an existing course",
    ],
] as const)
    registry.registerPath({
        method: "post",
        path,
        tags: ["Courses"],
        summary,
        security: [{ BearerAuth: [] }],
        request: {
            params,
            body: {
                required: true,
                content: { "application/json": { schema: apiSchema(schema) } },
            },
        },
        responses: {
            201: {
                description:
                    "Atomic import result; retrying the same key and content reuses this result.",
                content: { "application/json": { schema: apiSchema(courseImportResultSchema) } },
            },
            ...commonErrors,
        },
    });

registry.registerPath({
    method: "put",
    path: "/api/v1/lessons/{lessonId}",
    tags: ["Courses"],
    summary: "Save lesson content and ordered imported quizzes atomically (any signed-in user)",
    security: [{ BearerAuth: [] }],
    request: {
        params: lessonParamsSchema,
        body: {
            required: true,
            content: { "application/json": { schema: apiSchema(saveLessonBodySchema) } },
        },
    },
    responses: {
        200: {
            description: "Saved lesson",
            content: { "application/json": { schema: apiSchema(lessonDetailSchema) } },
        },
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
            { name: "Courses", description: "Public learning content." },
            { name: "Quizzes", description: "Quiz management endpoints." },
            { name: "Tags", description: "User-scoped tag endpoints." },
        ],
    });
}
