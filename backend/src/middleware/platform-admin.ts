import type { RequestHandler } from "express";
import { AppError } from "../errors/app-error.ts";

export const requirePlatformAdmin: RequestHandler = (request, _response, next) => {
    if (!request.currentProfile?.isPlatformAdmin)
        throw new AppError(
            403,
            "PLATFORM_ADMIN_REQUIRED",
            "Platform administrator access is required",
        );
    next();
};
