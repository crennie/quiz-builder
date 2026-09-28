import type { RequestHandler } from "express";

import { verifyAccessToken, type AuthenticatedUser } from "../auth/supabase.ts";
import { getOrCreateProfile, type Profile } from "../db/profiles.ts";
import { AppError } from "../errors/app-error.ts";

declare module "express-serve-static-core" {
    interface Request {
        authenticatedUser?: AuthenticatedUser;
        currentProfile?: Profile;
    }
}

async function authenticate(
    request: Parameters<RequestHandler>[0],
    required: boolean,
): Promise<void> {
    const authorization = request.header("authorization");
    if (!authorization && !required) return;
    const match = /^Bearer ([^\s]+)$/i.exec(authorization ?? "");

    if (!match) {
        throw new AppError(401, "UNAUTHORIZED", "A valid access token is required");
    }

    const user = await verifyAccessToken(match[1]);
    const profile = await getOrCreateProfile(user);
    request.authenticatedUser = user;
    request.currentProfile = profile;
}

export const requireAuthentication: RequestHandler = async (request, _response, next) => {
    await authenticate(request, true);
    next();
};

export const optionalAuthentication: RequestHandler = async (request, _response, next) => {
    await authenticate(request, false);
    next();
};
