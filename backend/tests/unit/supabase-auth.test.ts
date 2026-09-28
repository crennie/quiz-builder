import { beforeEach, describe, expect, it, vi } from "vitest";

const getClaims = vi.hoisted(() => vi.fn());
vi.mock("@supabase/supabase-js", () => ({
    createClient: () => ({ auth: { getClaims } }),
    isAuthRetryableFetchError: (error: unknown) =>
        error instanceof Error && error.name === "AuthRetryableFetchError",
}));

import { verifyAccessToken } from "../../src/auth/supabase.ts";

const validClaims = {
    iss: "https://example.supabase.co/auth/v1",
    sub: "123e4567-e89b-42d3-a456-426614174000",
    aud: "authenticated",
    role: "authenticated",
    exp: 1_800_000_000,
    session_id: "223e4567-e89b-42d3-a456-426614174000",
    user_metadata: { full_name: "Example User" },
};

describe("verifyAccessToken", () => {
    beforeEach(() => vi.resetAllMocks());

    it("uses Supabase's verified claims and canonical Auth UUID", async () => {
        getClaims.mockResolvedValueOnce({ data: { claims: validClaims }, error: null });

        await expect(verifyAccessToken("access-token")).resolves.toEqual({
            id: validClaims.sub,
            userMetadata: validClaims.user_metadata,
        });
        expect(getClaims).toHaveBeenCalledWith("access-token");
    });

    it.each([
        { iss: "https://another-project.supabase.co/auth/v1" },
        { aud: "anon" },
        { role: "service_role" },
        { sub: "not-a-uuid" },
        { session_id: "not-a-uuid" },
    ])("rejects an unexpected identity claim: %j", async (override) => {
        getClaims.mockResolvedValueOnce({
            data: { claims: { ...validClaims, ...override } },
            error: null,
        });

        await expect(verifyAccessToken("access-token")).rejects.toMatchObject({
            statusCode: 401,
            code: "UNAUTHORIZED",
        });
    });

    it("rejects a token Supabase fails to verify", async () => {
        getClaims.mockResolvedValueOnce({ data: null, error: new Error("invalid signature") });

        await expect(verifyAccessToken("bad-token")).rejects.toMatchObject({
            statusCode: 401,
            code: "UNAUTHORIZED",
        });
    });

    it("reports a retryable Auth outage separately from an invalid token", async () => {
        const error = new Error("network down");
        error.name = "AuthRetryableFetchError";
        getClaims.mockResolvedValueOnce({ data: null, error });

        await expect(verifyAccessToken("access-token")).rejects.toMatchObject({
            statusCode: 503,
            code: "AUTH_UNAVAILABLE",
        });
    });
});
