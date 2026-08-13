import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { app } from "../../src/app.ts";
import { errorHandler } from "../../src/middleware/errors.ts";
import { requestLogger } from "../../src/middleware/request-logging.ts";

describe("backend API", () => {
    it("reports a healthy service", async () => {
        const response = await request(app).get("/health");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({ status: "ok" });
    });

    it("returns the centralized JSON response for an unknown route", async () => {
        const response = await request(app).get("/does-not-exist");

        expect(response.status).toBe(404);
        expect(response.body).toEqual({
            error: {
                code: "NOT_FOUND",
                message: "Route GET /does-not-exist was not found",
            },
        });
    });

    it("does not expose unexpected errors", async () => {
        const errorApp = express();
        errorApp.use(requestLogger);
        errorApp.get("/error", () => {
            throw new Error("sensitive implementation detail");
        });
        errorApp.use(errorHandler);

        const response = await request(errorApp).get("/error");

        expect(response.status).toBe(500);
        expect(response.body).toEqual({
            error: {
                code: "INTERNAL_SERVER_ERROR",
                message: "An unexpected error occurred",
            },
        });
    });
});
