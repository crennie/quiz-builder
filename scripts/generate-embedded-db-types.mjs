// Generate the Supabase-compatible public types from an actual clean PostgreSQL catalog.
// This fallback uses PGlite when Docker/Supabase is unavailable. Use db:types for Supabase parity.
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
const db = new PGlite();
try {
    await db.exec("CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY)");
    for (const name of readdirSync("supabase/migrations")
        .filter((n) => n.endsWith(".sql"))
        .sort())
        await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
    const enums = (
        await db.query(
            `SELECT t.typname,array_agg(e.enumlabel ORDER BY e.enumsortorder) AS labels FROM pg_type t JOIN pg_enum e ON e.enumtypid=t.oid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' GROUP BY t.typname ORDER BY t.typname`,
        )
    ).rows;
    const enumNames = new Set(enums.map((e) => e.typname));
    const cols = (
        await db.query(
            `SELECT table_name,column_name,is_nullable,column_default,udt_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position`,
        )
    ).rows;
    const fks = (
        await db.query(`SELECT con.conname AS name,src.relname AS source,dst.relname AS target,
 (SELECT array_agg(a.attname ORDER BY u.ord) FROM unnest(con.conkey) WITH ORDINALITY u(num,ord) JOIN pg_attribute a ON a.attrelid=con.conrelid AND a.attnum=u.num) AS columns,
 (SELECT array_agg(a.attname ORDER BY u.ord) FROM unnest(con.confkey) WITH ORDINALITY u(num,ord) JOIN pg_attribute a ON a.attrelid=con.confrelid AND a.attnum=u.num) AS targets,
 EXISTS(SELECT 1 FROM pg_constraint uq WHERE uq.conrelid=con.conrelid AND uq.contype IN ('u','p') AND uq.conkey=con.conkey) AS one
 FROM pg_constraint con JOIN pg_class src ON src.oid=con.conrelid JOIN pg_class dst ON dst.oid=con.confrelid JOIN pg_namespace n ON n.oid=src.relnamespace WHERE con.contype='f' AND n.nspname='public' ORDER BY con.conname`)
    ).rows;
    const tables = {};
    for (const c of cols) (tables[c.table_name] ??= []).push(c);
    function type(c) {
        return enumNames.has(c.udt_name)
            ? `Database["public"]["Enums"]["${c.udt_name}"]`
            : c.udt_name === "jsonb"
              ? c.is_nullable === "YES"
                  ? "Json"
                  : "NonNullable<Json>"
              : ["int4", "int8", "numeric", "float8"].includes(c.udt_name)
                ? "number"
                : c.udt_name === "bool"
                  ? "boolean"
                  : "string";
    }
    let out =
        "// Generated from the clean V1 catalog by scripts/generate-embedded-db-types.mjs.\nexport type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];\nexport type Database = { public: { Tables: {\n";
    for (const [name, cs] of Object.entries(tables)) {
        out += `${name}: {\n`;
        for (const kind of ["Row", "Insert", "Update"])
            out += `${kind}: {\n${cs.map((c) => `${c.column_name}${kind === "Update" || (kind === "Insert" && (c.is_nullable === "YES" || c.column_default !== null)) ? "?" : ""}: ${type(c)}${c.is_nullable === "YES" ? " | null" : ""};`).join("\n")}\n};\n`;
        out += `Relationships: [${fks
            .filter((f) => f.source === name)
            .map(
                (f) =>
                    `{foreignKeyName:${JSON.stringify(f.name)}; columns:${JSON.stringify(f.columns)};isOneToOne:${f.one};referencedRelation:${JSON.stringify(f.target)};referencedColumns:${JSON.stringify(f.targets)};}`,
            )
            .join(",")}];\n};\n`;
    }
    out += "}; Views: { [_ in never]: never }; Functions: { [_ in never]: never }; Enums: {\n";
    for (const e of enums) out += `${e.typname}: ${e.labels.map(JSON.stringify).join(" | ")};\n`;
    out += "}; CompositeTypes: { [_ in never]: never }; }; };\n";
    writeFileSync("shared/src/database.types.ts", out);
    console.log(
        `Generated public types for ${Object.keys(tables).length} tables from a fresh V1 database.`,
    );
} finally {
    await db.close();
}
