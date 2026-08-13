import { defineConfig } from "drizzle-kit";

import { config } from "./src/config.ts";

export default defineConfig({
    dialect: "postgresql",
    out: "./drizzle",
    dbCredentials: {
        url: config.databaseUrl,
    },
});
