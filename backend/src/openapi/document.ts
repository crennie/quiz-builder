import { OpenAPIRegistry, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";

import { errorResponseSchema } from "../api/schemas/error.ts";
import { healthResponseSchema } from "../api/schemas/health.ts";

const registry = new OpenAPIRegistry();

const errorContent = {
    "application/json": {
        schema: errorResponseSchema,
    },
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

export function createOpenApiDocument() {
    const generator = new OpenApiGeneratorV31(registry.definitions);

    return generator.generateDocument({
        openapi: "3.1.0",
        info: {
            title: "Quiz Builder API",
            version: "0.0.1",
            description: "API for creating and practicing question-based study content.",
        },
        tags: [{ name: "Operations", description: "Service operational endpoints." }],
    });
}
