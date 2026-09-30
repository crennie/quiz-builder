import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

const directory = resolve(import.meta.dirname, "../../../supabase/migrations");

export async function applyMigrations(execute: (sql: string) => Promise<unknown>): Promise<void> {
    for (const name of readdirSync(directory)
        .filter((item) => item.endsWith(".sql"))
        .sort()) {
        await execute(readFileSync(resolve(directory, name), "utf8"));
    }
}
