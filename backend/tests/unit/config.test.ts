import { describe, expect, it } from "vitest";

import { loadAuthConfig, loadConfig } from "../../src/config.ts";

describe("loadConfig", () => {
    it("loads a PostgreSQL database URL", () => {
        const result = loadConfig({
            DATABASE_URL: "postgresql://user:password@localhost:5432/quiz_builder",
        });

        expect(result.databaseUrl).toBe("postgresql://user:password@localhost:5432/quiz_builder");
    });

    it("rejects a database URL with a non-PostgreSQL protocol", () => {
        expect(() => loadConfig({ DATABASE_URL: "https://example.com/database" })).toThrow(
            "DATABASE_URL must use the postgres or postgresql protocol",
        );
    });
});

describe("loadAuthConfig", () => {
    it("accepts a hosted Supabase project URL and publishable key", () => {
        expect(
            loadAuthConfig({
                SUPABASE_URL: "https://example.supabase.co/",
                SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
            }),
        ).toEqual({
            supabaseUrl: "https://example.supabase.co",
            supabasePublishableKey: "sb_publishable_test",
        });
    });

    it("accepts HTTP only for local Supabase", () => {
        expect(
            loadAuthConfig({
                SUPABASE_URL: "http://127.0.0.1:54321",
                SUPABASE_PUBLISHABLE_KEY: "local-key",
            }).supabaseUrl,
        ).toBe("http://127.0.0.1:54321");

        expect(() =>
            loadAuthConfig({
                SUPABASE_URL: "http://example.supabase.co",
                SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
            }),
        ).toThrow("SUPABASE_URL must use HTTPS");
    });
});
