import { expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { applicationRebuildSql, inspectRebuild } from "../../../scripts/application-rebuild.mjs";
import { applyMigrations } from "./apply-migrations.ts";
import { owner } from "./v1-fixtures.ts";
it("rebuilds only application content while retaining Auth identity and the exact profile", async () => {
    const db = new PGlite();
    try {
        await db.exec("CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY)");
        await applyMigrations((s) => db.exec(s));
        await db.query("INSERT INTO auth.users(id) VALUES($1)", [owner]);
        await db.query(
            "INSERT INTO public.profiles(id,display_name,avatar_url) VALUES($1,'Established tester','https://example.test/avatar')",
            [owner],
        );
        await db.exec("INSERT INTO public.courses(title) VALUES('Disposable content')");
        const before = await inspectRebuild(db, owner);
        await db.exec("BEGIN");
        await db.exec(applicationRebuildSql());
        const after = await inspectRebuild(db, owner);
        expect(after).toEqual(before);
        expect((await db.query("SELECT * FROM public.courses")).rows).toEqual([]);
        await db.exec("COMMIT");
    } finally {
        await db.close();
    }
});
