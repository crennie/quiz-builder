import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./e2e",
    fullyParallel: false,
    timeout: 90_000,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? "github" : "list",
    use: {
        baseURL: "http://127.0.0.1:5173",
        trace: "retain-on-failure",
    },
    projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
    webServer: [
        {
            command: "node ../scripts/start-e2e-server.mjs backend",
            url: "http://127.0.0.1:3000/health",
            timeout: 120_000,
        },
        {
            command: "node ../scripts/start-e2e-server.mjs frontend",
            url: "http://127.0.0.1:5173/sign-in",
            timeout: 120_000,
        },
    ],
});
