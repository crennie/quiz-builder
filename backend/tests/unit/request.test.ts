import { describe, expect, it } from "vitest";
import { z } from "zod";

import { validateRequest } from "../../src/api/request.ts";
import type { AppError } from "../../src/errors/app-error.ts";

const requestSchemas = {
    params: z.object({ questionId: z.string().uuid() }),
    query: z.object({ limit: z.coerce.number().int().positive() }),
    body: z.object({ prompt: z.string().trim().min(1) }),
};

describe("validateRequest", () => {
    it("validates and types all request inputs", () => {
        const result = validateRequest(
            {
                params: { questionId: "123e4567-e89b-12d3-a456-426614174000" },
                query: { limit: "10" },
                body: { prompt: "  What is TypeScript?  " },
            },
            requestSchemas,
        );

        expect(result).toEqual({
            params: { questionId: "123e4567-e89b-12d3-a456-426614174000" },
            query: { limit: 10 },
            body: { prompt: "What is TypeScript?" },
        });
    });

    it("converts Zod failures to the standard application error", () => {
        expect(() =>
            validateRequest(
                {
                    params: { questionId: "not-a-uuid" },
                    query: { limit: "0" },
                    body: { prompt: "" },
                },
                requestSchemas,
            ),
        ).toThrowError(
            expect.objectContaining<Partial<AppError>>({
                statusCode: 400,
                code: "VALIDATION_ERROR",
                message: "Request validation failed",
            }),
        );
    });
});
