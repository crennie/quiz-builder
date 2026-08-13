import { Router, type Response } from "express";

import { healthResponseSchema, type HealthResponse } from "../api/schemas/health.ts";
import { sendResponse } from "../api/response.ts";

export const healthRouter = Router();

healthRouter.get("/health", (_request, response: Response<HealthResponse>) => {
    sendResponse(response, 200, healthResponseSchema, { status: "ok" });
});
