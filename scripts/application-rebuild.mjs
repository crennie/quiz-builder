import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const baselineUrl = new URL(
    "../supabase/migrations/20261013120000_v1_baseline.sql",
    import.meta.url,
);
export const baselineVersion = "20261013120000";
export const replacedVersions = [
    "20260928174208",
    "20260930120000",
    "20260930160000",
    "20260930190000",
    "20260930220000",
    "20261001010000",
];
export const contentTables = [
    "feedback",
    "question_batch_items",
    "question_batches",
    "work_item_events",
    "question_publication_gate_decisions",
    "question_review_decisions",
    "question_review_submissions",
    "agent_execution_runs",
    "agent_generation_runs",
    "work_items",
    "agent_actors",
    "quiz_attempt_questions",
    "quiz_attempts",
    "lesson_quizzes",
    "lessons",
    "courses",
    "quiz_tags",
    "question_tags",
    "tags",
    "quiz_version_questions",
    "quiz_questions",
    "quiz_versions",
    "quizzes",
    "question_versions",
    "question_publication_events",
    "questions",
];
const functions = [
    "protect_attempt_snapshots",
    "check_attempt_question_membership",
    "protect_attempt_question_snapshots",
    "reject_immutable_row_change",
    "guard_question",
    "guard_quiz",
    "guard_composition",
    "guard_lesson_quiz",
    "guard_attempt",
    "guard_attempt_question",
    "check_complete_attempt_snapshot",
];
const types = [
    "content_status",
    "content_visibility",
    "question_type",
    "quiz_attempt_status",
    "feedback_category",
    "feedback_status",
];
export function applicationRebuildSql() {
    const baseline = readFileSync(baselineUrl, "utf8");
    // profiles is never dropped, copied, rewritten or re-created. Its Auth FK remains intact.
    const retained = baseline.replace(/CREATE TABLE public\.profiles \([\s\S]*?\n\);\n/, "");
    return `LOCK TABLE public.profiles IN ACCESS EXCLUSIVE MODE;\nDROP TABLE IF EXISTS ${contentTables.map((n) => `public.${n}`).join(", ")} CASCADE;\n${functions.map((n) => `DROP FUNCTION IF EXISTS public.${n}();`).join("\n")}\n${types.map((n) => `DROP TYPE IF EXISTS public.${n};`).join("\n")}\n${retained}`;
}
export async function inspectRebuild(database, preservedId) {
    const profiles = await database.query("SELECT * FROM public.profiles ORDER BY id");
    const ids = await database.query("SELECT id FROM auth.users ORDER BY id");
    if (
        !profiles.rows.some((r) => r.id === preservedId) ||
        !ids.rows.some((r) => r.id === preservedId)
    )
        throw new Error("The preserved account must exist in both Auth and profiles");
    const tables = await database.query(
        "SELECT tablename FROM pg_tables WHERE schemaname='public'",
    );
    const allowed = new Set(["profiles", ...contentTables]);
    if (tables.rows.some((r) => !allowed.has(r.tablename)))
        throw new Error("Unknown public tables exist; inspect dependencies before rebuilding");
    // Never cascade into an object outside the recognized application table set.
    const dependencies = await database.query(
        `SELECT child.relname AS child,n.nspname AS schema FROM pg_constraint con JOIN pg_class child ON child.oid=con.conrelid JOIN pg_namespace n ON n.oid=child.relnamespace JOIN pg_class parent ON parent.oid=con.confrelid JOIN pg_namespace pn ON pn.oid=parent.relnamespace WHERE con.contype='f' AND pn.nspname='public' AND parent.relname=ANY($1::text[])`,
        [contentTables],
    );
    if (dependencies.rows.some((r) => r.schema !== "public" || !allowed.has(r.child)))
        throw new Error("Application content has foreign-key dependents outside rebuild scope");
    const views = await database.query(
        `SELECT DISTINCT dependent.relname FROM pg_depend d JOIN pg_rewrite r ON r.oid=d.objid JOIN pg_class dependent ON dependent.oid=r.ev_class JOIN pg_class source ON source.oid=d.refobjid JOIN pg_namespace n ON n.oid=source.relnamespace WHERE n.nspname='public' AND source.relname=ANY($1::text[]) AND dependent.relkind IN ('v','m')`,
        [contentTables],
    );
    if (views.rows.length)
        throw new Error("Dependent views need explicit review before rebuilding");
    return { profiles: profiles.rows, authIds: ids.rows };
}
// CLI is intentionally separate from SQL preparation; importing this module has no writes.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const mode = process.argv[2];
    const preservedId = process.argv[3];
    if (
        !["--check", "--execute"].includes(mode) ||
        !preservedId ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(preservedId)
    )
        throw new Error(
            "Usage: node --env-file=backend/.env.local scripts/application-rebuild.mjs --check|--execute <preserved-profile-uuid> [--writers-stopped]",
        );
    if (mode === "--execute" && !process.argv.includes("--writers-stopped"))
        throw new Error("Stop API writes before rebuilding and pass --writers-stopped");
    const { default: pg } = await import("../backend/node_modules/pg/lib/index.js");
    const { Client } = pg;
    const { isDeepStrictEqual } = await import("node:util");
    const db = new Client({
        connectionString: process.env.DATABASE_URL,
        connectionTimeoutMillis: 10000,
    });
    try {
        await db.connect();
        await db.query(mode === "--check" ? "BEGIN READ ONLY" : "BEGIN");
        await db.query("SET LOCAL lock_timeout='10s'");
        if (mode === "--execute")
            await db.query("LOCK TABLE public.profiles IN ACCESS EXCLUSIVE MODE");
        const before = await inspectRebuild(db, preservedId);
        if (mode === "--execute") {
            await db.query(applicationRebuildSql());
            const after = await inspectRebuild(db, preservedId);
            if (!isDeepStrictEqual(before, after))
                throw new Error("Auth identity/profile preservation check failed");
            const history = await db.query(
                "SELECT to_regclass('supabase_migrations.schema_migrations') AS table_name",
            );
            if (history.rows[0].table_name) {
                await db.query(
                    "DELETE FROM supabase_migrations.schema_migrations WHERE version=ANY($1::text[])",
                    [replacedVersions],
                );
                await db.query(
                    "INSERT INTO supabase_migrations.schema_migrations(version,name,statements) VALUES($1,$2,$3::text[]) ON CONFLICT(version) DO NOTHING",
                    [baselineVersion, "v1_baseline", [readFileSync(baselineUrl, "utf8")]],
                );
            }
        }
        await db.query("COMMIT");
        console.log(
            `${mode === "--check" ? "Preflight passed" : "Application rebuilt"}; ${before.profiles.length} profiles and ${before.authIds.length} Auth identities preserved. Test account: ${preservedId}`,
        );
    } catch (error) {
        await db.query("ROLLBACK").catch(() => {});
        throw error;
    } finally {
        await db.end();
    }
}
