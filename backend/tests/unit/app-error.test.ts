import { describe, expect, it } from "vitest";

import { AppError } from "../../src/errors/app-error.ts";

describe("AppError", () => {
    it("retains its HTTP error details", () => {
        const error = new AppError(400, "INVALID_REQUEST", "The request is invalid");

        expect(error).toBeInstanceOf(Error);
        expect(error.name).toBe("AppError");
        expect(error.statusCode).toBe(400);
        expect(error.code).toBe("INVALID_REQUEST");
        expect(error.message).toBe("The request is invalid");
    });
});
