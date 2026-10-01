import { spawn, spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const service = process.argv[2];
if (service !== "backend" && service !== "frontend") {
    throw new Error("Usage: node scripts/start-e2e-server.mjs <backend|frontend>");
}

const useAppEnvironment = process.env.E2E_USE_APP_ENV === "true";
let environment = process.env;
if (!useAppEnvironment) {
    const status = spawnSync(
        resolve(root, "node_modules/.bin/supabase"),
        ["status", "-o", "json"],
        {
            cwd: root,
            encoding: "utf8",
        },
    );
    if (status.status !== 0) {
        throw new Error("The local Supabase stack must be running before browser tests.");
    }

    const values = JSON.parse(status.stdout);
    const apiUrl = values.API_URL;
    const databaseUrl = values.DB_URL;
    const publishableKey = values.ANON_KEY;
    if (!apiUrl || !databaseUrl || !publishableKey) {
        throw new Error("Supabase status did not provide the local API, database, and anon key.");
    }

    environment = {
        ...process.env,
        DATABASE_URL: databaseUrl,
        SUPABASE_URL: apiUrl,
        SUPABASE_PUBLISHABLE_KEY: publishableKey,
        VITE_SUPABASE_URL: apiUrl,
        VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
        VITE_API_BASE_URL: "/api",
    };
}
const child = spawn(
    process.execPath,
    service === "backend"
        ? [...(useAppEnvironment ? ["--env-file=.env.local"] : []), "src/server.ts"]
        : ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1"],
    {
        cwd: resolve(root, service),
        env: environment,
        stdio: "inherit",
    },
);

for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => {
    process.exitCode = code ?? 1;
});
