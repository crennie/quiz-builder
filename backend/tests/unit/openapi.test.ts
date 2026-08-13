import { describe, expect, it } from "vitest";

import { createOpenApiDocument } from "../../src/openapi/document.ts";
import { validateOpenApiDocument } from "../../src/openapi/validate-document.ts";

describe("OpenAPI document", () => {
    it("is valid and documents the health contract", async () => {
        const document = createOpenApiDocument();

        await expect(validateOpenApiDocument()).resolves.toBeUndefined();
        expect(document.openapi).toBe("3.1.0");
        expect(document.paths?.["/health"]?.get?.responses?.["200"]).toBeDefined();
        expect(document.components?.schemas?.ErrorResponse).toBeDefined();
    });
});
