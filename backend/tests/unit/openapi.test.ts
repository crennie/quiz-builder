import { describe, expect, it } from "vitest";

import { createOpenApiDocument } from "../../src/openapi/document.ts";
import { validateOpenApiDocument } from "../../src/openapi/validate-document.ts";

describe("OpenAPI document", () => {
    it("is valid and documents the health contract", async () => {
        const document = createOpenApiDocument();

        await expect(validateOpenApiDocument()).resolves.toBeUndefined();
        expect(document.openapi).toBe("3.1.0");
        expect(document.paths?.["/health"]?.get?.responses?.["200"]).toBeDefined();
        expect(document.paths?.["/api/v1/me"]?.get?.security).toEqual([{ BearerAuth: [] }]);
        expect(document.paths?.["/api/v1/questions"]?.post?.security).toEqual([{ BearerAuth: [] }]);
        expect(document.paths?.["/api/v1/questions/{questionId}/versions"]?.post).toBeDefined();
        expect(document.paths?.["/api/v1/questions/{questionId}/tags/{tagId}"]?.put).toBeDefined();
        expect(document.paths?.["/api/v1/tags"]?.post).toBeDefined();
        expect(document.paths?.["/api/v1/quizzes"]?.post?.security).toEqual([{ BearerAuth: [] }]);
        expect(document.paths?.["/api/v1/quizzes/{quizId}/content"]?.put).toBeDefined();
        expect(document.paths?.["/api/v1/quizzes/{quizId}/versions"]?.get).toBeDefined();
        expect(document.paths?.["/api/v1/quizzes/{quizId}/tags/{tagId}"]?.put).toBeDefined();
        expect(document.components?.securitySchemes?.BearerAuth).toBeDefined();
        expect(document.components?.schemas?.ErrorResponse).toBeDefined();
    });
});
