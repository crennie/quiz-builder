import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        env: {
            DATABASE_URL:
                process.env.DATABASE_URL ??
                "postgresql://quiz_builder:quiz_builder@localhost:5432/quiz_builder_test",
            SUPABASE_URL: "https://example.supabase.co",
            SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
            NODE_ENV: "test",
        },
    },
});
