import { beforeEach, describe, expect, it, vi } from "vitest";

const query = vi.hoisted(() => vi.fn());
vi.mock("../../src/db/index.ts", () => ({ pool: { query } }));

import { getOrCreateProfile } from "../../src/db/profiles.ts";

const userId = "123e4567-e89b-42d3-a456-426614174000";
const existingRow = {
    id: userId,
    is_platform_admin: false,
    display_name: "Custom profile name",
    avatar_url: null,
    created_at: new Date("2026-09-28T00:00:00Z"),
    updated_at: new Date("2026-09-28T00:00:00Z"),
};

describe("getOrCreateProfile", () => {
    beforeEach(() => vi.resetAllMocks());

    it("seeds from Auth metadata without overwriting an existing profile", async () => {
        query.mockResolvedValueOnce({ rows: [] });
        query.mockResolvedValueOnce({ rows: [existingRow] });

        await expect(
            getOrCreateProfile({
                id: userId,
                userMetadata: {
                    is_platform_admin: true,
                    isPlatformAdmin: true,
                    full_name: "Auth name",
                    avatar_url: "javascript:alert(1)",
                },
            }),
        ).resolves.toMatchObject({ isPlatformAdmin: false, displayName: "Custom profile name" });

        expect(query.mock.calls[0]?.[0]).toContain("ON CONFLICT (id) DO NOTHING");
        expect(query.mock.calls[0]?.[1]).toEqual([userId, "Auth name", null]);
        expect(query.mock.calls[1]?.[1]).toEqual([userId]);
    });
    it("preserves a database-granted admin role regardless of Auth metadata", async () => {
        query.mockResolvedValueOnce({ rows: [] });
        query.mockResolvedValueOnce({ rows: [{ ...existingRow, is_platform_admin: true }] });
        await expect(
            getOrCreateProfile({ id: userId, userMetadata: { is_platform_admin: false } }),
        ).resolves.toMatchObject({ isPlatformAdmin: true });
        expect(query.mock.calls[0]?.[0]).not.toContain("is_platform_admin");
    });
});
