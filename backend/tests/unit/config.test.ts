import { describe, expect, it } from "vitest";

import { loadConfig } from "../../src/config.ts";

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
