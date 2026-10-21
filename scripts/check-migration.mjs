import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
export const applicationTables = [
    "profiles",
    "questions",
    "quizzes",
    "quiz_questions",
    "quiz_attempts",
    "quiz_attempt_questions",
    "courses",
    "lessons",
    "lesson_quizzes",
    "tags",
    "question_tags",
    "quiz_tags",
    "feedback",
    "question_batches",
    "question_batch_items",
];
try {
    await db.exec("CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY)");
    const migrations = readdirSync("supabase/migrations")
        .filter((n) => n.endsWith(".sql"))
        .sort();
    assert.equal(
        migrations[0],
        "20261013120000_v1_baseline.sql",
        "V1 migrations start with the baseline",
    );
    for (const name of migrations)
        await db.exec(readFileSync(`supabase/migrations/${name}`, "utf8"));
    const tables = (
        await db.query(
            "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename",
        )
    ).rows.map((r) => r.tablename);
    assert.deepEqual(tables, [...applicationTables].sort());
    const rls = (
        await db.query(
            "SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity",
        )
    ).rows[0].count;
    assert.equal(rls, applicationTables.length);
    assert.equal(
        (await db.query("SELECT count(*)::int AS count FROM pg_policies WHERE schemaname='public'"))
            .rows[0].count,
        0,
    );
    const columns = (
        await db.query(
            "SELECT column_name FROM information_schema.columns WHERE table_schema='public'",
        )
    ).rows.map((r) => r.column_name);
    assert.ok(!columns.some((n) => /version|agent|work_item|published/.test(n)));
    const enums = (
        await db.query(
            "SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='content_visibility' ORDER BY e.enumsortorder",
        )
    ).rows.map((r) => r.enumlabel);
    assert.deepEqual(enums, ["private", "public"]);
    const guards = (
        await db.query("SELECT tgname FROM pg_trigger WHERE NOT tgisinternal ORDER BY tgname")
    ).rows.map((r) => r.tgname);
    for (const name of [
        "questions_guard",
        "quizzes_guard",
        "quiz_questions_guard",
        "lesson_quizzes_guard",
        "quiz_attempts_guard",
        "quiz_attempts_preserve",
        "quiz_attempt_questions_guard",
        "quiz_attempt_questions_preserve",
        "question_batches_immutable",
        "question_batch_items_immutable",
        "quiz_attempts_complete_snapshot",
        "quiz_attempt_questions_complete_snapshot",
    ])
        assert.ok(guards.includes(name), `Missing ${name}`);
    console.log(
        `Fresh V1 baseline passed: ${tables.length} tables, closed RLS, direct identities and all integrity guards.`,
    );
} finally {
    await db.close();
}
