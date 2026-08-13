import { defineConfig } from "drizzle-kit";

import { config } from "./src/config.ts";

export default defineConfig({
    dialect: "postgresql",
    out: "./drizzle",
    schema: "./src/db/schema.ts",
    dbCredentials: {
        url: config.databaseUrl,
    },
});
