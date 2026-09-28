import { createClient, isAuthRetryableFetchError } from "@supabase/supabase-js";
import { z } from "zod";

import { loadAuthConfig } from "../config.ts";
import { AppError } from "../errors/app-error.ts";

const claimsSchema = z.object({
    iss: z.string(),
    sub: z.uuid(),
    aud: z.union([z.string(), z.array(z.string())]),
    role: z.literal("authenticated"),
    exp: z.number().int(),
    session_id: z.uuid(),
    user_metadata: z.record(z.string(), z.unknown()).optional(),
});

export type AuthenticatedUser = Readonly<{
    id: string;
    userMetadata: Record<string, unknown>;
}>;

const authConfig = loadAuthConfig();
const authClient = createClient(authConfig.supabaseUrl, authConfig.supabasePublishableKey, {
    auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
    },
});

export async function verifyAccessToken(token: string): Promise<AuthenticatedUser> {
    const { data, error } = await authClient.auth.getClaims(token);

    if (isAuthRetryableFetchError(error)) {
        throw new AppError(503, "AUTH_UNAVAILABLE", "Authentication service is unavailable", {
            cause: error,
        });
    }

    if (error || !data) {
        throw new AppError(401, "UNAUTHORIZED", "A valid access token is required");
    }

    const parsed = claimsSchema.safeParse(data.claims);
    if (!parsed.success) {
        throw new AppError(401, "UNAUTHORIZED", "A valid access token is required");
    }

    const claims = parsed.data;
    const audience = claims.aud;
    if (
        claims.iss !== `${authConfig.supabaseUrl}/auth/v1` ||
        (typeof audience === "string"
            ? audience !== "authenticated"
            : !audience.includes("authenticated"))
    ) {
        throw new AppError(401, "UNAUTHORIZED", "A valid access token is required");
    }

    return {
        id: claims.sub,
        userMetadata: claims.user_metadata ?? {},
    };
}
