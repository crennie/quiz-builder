import react from "@vitejs/plugin-react";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
    plugins: [react()],
    server: {
        host: "0.0.0.0", // needed for devcontainer port forwarding
        port: 5173,
        proxy: {
            "/api": {
                target: "http://localhost:3000",
                rewrite: (path) => (path === "/api/health" ? "/health" : path),
            },
        },
    },
    test: {
        exclude: [...configDefaults.exclude, "e2e/**"],
        environment: "jsdom",
        globals: true,
        setupFiles: "./src/test/setup.ts",
        restoreMocks: true,
    },
});
