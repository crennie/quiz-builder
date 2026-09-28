import { Router, type Response } from "express";

import {
    currentUserResponseSchema,
    type CurrentUserResponse,
} from "../api/schemas/current-user.ts";
import { sendResponse } from "../api/response.ts";
import { requireAuthentication } from "../middleware/authentication.ts";

export const currentUserRouter = Router();

currentUserRouter.get(
    "/me",
    requireAuthentication,
    (request, response: Response<CurrentUserResponse>) => {
        const profile = request.currentProfile;
        if (!profile) throw new Error("Current profile was not set by middleware");

        sendResponse(response, 200, currentUserResponseSchema, {
            id: profile.id,
            displayName: profile.displayName,
            avatarUrl: profile.avatarUrl,
            createdAt: profile.createdAt.toISOString(),
            updatedAt: profile.updatedAt.toISOString(),
        });
    },
);
