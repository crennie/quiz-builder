import { spawnSync } from "node:child_process";
import { writeFileSync, renameSync } from "node:fs";
import { checkDatabaseTypeShape } from "./check-db-type-shape.mjs";
import { resolve } from "node:path";

const source = process.argv.slice(2).find((arg) => arg !== "--check") ?? "--local";
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

if (process.argv.includes("--check")) {
    checkDatabaseTypeShape(result.stdout);
    console.log(
        "Generated V1 database type shapes match the committed tables, relationships, and enums.",
    );
    process.exit(0);
}

const output = resolve("shared/src/database.types.ts");
const temporary = `${output}.tmp`;
writeFileSync(temporary, result.stdout.replace(/[\t ]+$/gm, ""), { mode: 0o644 });
renameSync(temporary, output);
console.log(`Generated ${output}`);
