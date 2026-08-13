import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        env: {
            DATABASE_URL:
                process.env.DATABASE_URL ??
                "postgresql://quiz_builder:quiz_builder@localhost:5432/quiz_builder_test",
            NODE_ENV: "test",
        },
    },
});
