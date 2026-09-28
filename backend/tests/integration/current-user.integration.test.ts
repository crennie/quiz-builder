import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { verifyAccessToken } from "../../src/auth/supabase.ts";
import { getOrCreateProfile } from "../../src/db/profiles.ts";
import { AppError } from "../../src/errors/app-error.ts";

vi.mock("../../src/auth/supabase.ts", () => ({ verifyAccessToken: vi.fn() }));
vi.mock("../../src/db/profiles.ts", () => ({ getOrCreateProfile: vi.fn() }));

import { app } from "../../src/app.ts";

const userId = "123e4567-e89b-42d3-a456-426614174000";
const profile = {
    id: userId,
    displayName: "Example User",
    avatarUrl: null,
    createdAt: new Date("2026-09-28T00:00:00.000Z"),
    updatedAt: new Date("2026-09-28T00:00:00.000Z"),
};

describe("GET /api/v1/me", () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it("rejects requests without a bearer token", async () => {
        const response = await request(app).get("/api/v1/me");

        expect(response.status).toBe(401);
        expect(response.body).toMatchObject({ error: { code: "UNAUTHORIZED" } });
        expect(verifyAccessToken).not.toHaveBeenCalled();
        expect(getOrCreateProfile).not.toHaveBeenCalled();
    });

    it("rejects invalid tokens", async () => {
        vi.mocked(verifyAccessToken).mockRejectedValueOnce(
            new AppError(401, "UNAUTHORIZED", "A valid access token is required"),
        );

        const response = await request(app)
            .get("/api/v1/me")
            .set("Authorization", "Bearer invalid");

        expect(response.status).toBe(401);
        expect(getOrCreateProfile).not.toHaveBeenCalled();
    });

    it("returns the profile for a verified user", async () => {
        const user = { id: userId, userMetadata: { full_name: "Example User" } };
        vi.mocked(verifyAccessToken).mockResolvedValueOnce(user);
        vi.mocked(getOrCreateProfile).mockResolvedValueOnce(profile);

        const response = await request(app).get("/api/v1/me").set("Authorization", "Bearer valid");

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            id: userId,
            displayName: "Example User",
            avatarUrl: null,
            createdAt: profile.createdAt.toISOString(),
            updatedAt: profile.updatedAt.toISOString(),
        });
        expect(getOrCreateProfile).toHaveBeenCalledWith(user);
    });
});
