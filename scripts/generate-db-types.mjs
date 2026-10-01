import { spawnSync } from "node:child_process";
import { writeFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";

const source = process.argv[2] ?? "--local";
if (!["--local", "--linked", "--db-url"].includes(source)) {
    throw new Error("Usage: npm run db:types -- [--local|--linked|--db-url]");
}

const cli = resolve("node_modules/.bin/supabase");
if (source === "--db-url" && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for --db-url type generation");
}
const result = spawnSync(
    cli,
    [
        "gen",
        "types",
        "typescript",
        source,
        ...(source === "--db-url" ? [process.env.DATABASE_URL] : []),
        "--schema",
        "public",
    ],
    { encoding: "utf8" },
);

if (result.status !== 0 || !result.stdout?.includes("export type Database")) {
    throw new Error(`Supabase type generation failed (${source}). Check the selected database.`);
}

const output = resolve("shared/src/database.types.ts");
const temporary = `${output}.tmp`;
writeFileSync(temporary, result.stdout.replace(/[\t ]+$/gm, ""), { mode: 0o644 });
renameSync(temporary, output);
console.log(`Generated ${output}`);
