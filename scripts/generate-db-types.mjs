import { spawnSync } from "node:child_process";
import { writeFileSync, renameSync } from "node:fs";
import { resolve } from "node:path";

const source = process.argv[2] ?? "--local";
if (!["--local", "--linked"].includes(source)) {
    throw new Error("Usage: npm run db:types -- [--local|--linked]");
}

const cli = resolve("node_modules/.bin/supabase");
const result = spawnSync(cli, ["gen", "types", "typescript", source, "--schema", "public"], {
    encoding: "utf8",
});

if (result.status !== 0 || !result.stdout?.includes("export type Database")) {
    throw new Error(
        `Supabase type generation failed (${source}). Check the local stack or CLI link.`,
    );
}

const output = resolve("shared/src/database.types.ts");
const temporary = `${output}.tmp`;
writeFileSync(temporary, result.stdout, { mode: 0o644 });
renameSync(temporary, output);
console.log(`Generated ${output}`);
