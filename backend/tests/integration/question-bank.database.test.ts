import { applyMigrations } from "./apply-migrations.ts";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
    archiveQuestionInTransaction,
    assignQuestionTagInTransaction,
    createQuestionInTransaction,
    createQuestionVersionInTransaction,
    createTag,
    getBankQuestionDetail,
    getQuestionDetail,
    getPublishedQuestionVersions,
    getQuestionVersions,
    listQuestions,
    listTags,
    publishQuestionInTransaction,
    removeQuestionTagInTransaction,
    restoreQuestionInTransaction,
    unpublishQuestionInTransaction,
    updateQuestionMetadataInTransaction,
    type QueryExecutor,
} from "../../src/db/question-bank.ts";

const ownerId = "00000000-0000-4000-8000-000000000101";
const otherId = "00000000-0000-4000-8000-000000000102";
const firstContent = {
    prompt: "What is two plus two?",
    questionType: "exact_text" as const,
    answerConfig: { questionType: "exact_text" as const, acceptedAnswers: ["4"] },
    gradingConfig: {
        questionType: "exact_text" as const,
        caseSensitive: false,
        trimWhitespace: true,
    },
    explanation: "Two and two make four.",
};
const secondContent = { ...firstContent, prompt: "What is 2 + 2?" };

describe("question bank persistence", () => {
    let database: PGlite;
    let sql: QueryExecutor;

    beforeAll(async () => {
        database = new PGlite();
        sql = database as unknown as QueryExecutor;
        await database.exec("CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY)");
        await applyMigrations((sql) => database.exec(sql));
        for (const id of [ownerId, otherId]) {
            await database.query("INSERT INTO auth.users (id) VALUES ($1)", [id]);
            await database.query("INSERT INTO public.profiles (id, display_name) VALUES ($1, $2)", [
                id,
                "Test User",
            ]);
        }
    });

    afterAll(async () => {
        await database.close();
    });

    it("creates immutable versions, preserves history, and keeps metadata separate", async () => {
        await database.exec("BEGIN");
        const created = await createQuestionInTransaction(
            ownerId,
            { content: firstContent, visibility: "private" },
            sql,
        );
        await database.exec("COMMIT");

        expect(created.currentVersion.versionNumber).toBe(1);
        expect(created.currentVersion.answerConfig).toEqual(firstContent.answerConfig);
        expect(await getQuestionDetail(created.id, otherId, sql)).toBeNull();
        expect(await getBankQuestionDetail(created.id, null, sql)).toBeNull();
        await expect(
            createQuestionVersionInTransaction(created.id, otherId, secondContent, sql),
        ).rejects.toMatchObject({ code: "QUESTION_NOT_FOUND" });

        await database.exec("BEGIN");
        await updateQuestionMetadataInTransaction(
            created.id,
            ownerId,
            { visibility: "public" },
            sql,
        );
        await database.exec("COMMIT");
        expect(await getBankQuestionDetail(created.id, null, sql)).toBeNull();

        await database.exec("BEGIN");
        const revised = await createQuestionVersionInTransaction(
            created.id,
            ownerId,
            secondContent,
            sql,
        );
        await database.exec("COMMIT");

        expect(revised.currentVersion.versionNumber).toBe(2);
        expect(revised.currentVersion.prompt).toBe(secondContent.prompt);
        const versions = await getQuestionVersions(created.id, ownerId, sql);
        expect(versions.map((version) => version.prompt)).toEqual([
            secondContent.prompt,
            firstContent.prompt,
        ]);
        await expect(
            database.query("UPDATE public.question_versions SET prompt = 'changed' WHERE id = $1", [
                versions[1]?.id,
            ]),
        ).rejects.toThrow();

        await database.exec("BEGIN");
        const published = await publishQuestionInTransaction(
            created.id,
            ownerId,
            revised.currentVersion.id,
            sql,
        );
        await database.exec("COMMIT");

        expect(published.currentVersion.id).toBe(revised.currentVersion.id);
        const initialEvents = await database.query<{ event_type: string; actor_id: string }>(
            `SELECT event_type, actor_id FROM public.question_publication_events
             WHERE question_id = $1 ORDER BY created_at, event_type`,
            [created.id],
        );
        expect(initialEvents.rows).toEqual([
            { event_type: "direct_approved", actor_id: ownerId },
            { event_type: "published", actor_id: ownerId },
        ]);
        await expect(
            publishQuestionInTransaction(created.id, ownerId, created.currentVersion.id, sql),
        ).rejects.toMatchObject({ code: "STALE_QUESTION_VERSION" });
        expect(await getQuestionVersions(created.id, ownerId, sql)).toHaveLength(2);
        const publicQuestion = await getBankQuestionDetail(created.id, null, sql);
        expect(publicQuestion?.publishedVersion.answerConfig).toEqual(firstContent.answerConfig);
        expect(
            (await listQuestions({ viewerId: null, limit: 50, offset: 0 }, sql)).items,
        ).toHaveLength(1);

        await database.exec("BEGIN");
        const newerDraft = await createQuestionVersionInTransaction(
            created.id,
            ownerId,
            { ...firstContent, prompt: "Unpublished revision" },
            sql,
        );
        await database.exec("COMMIT");
        expect((await getQuestionDetail(created.id, ownerId, sql))?.currentVersion.id).toBe(
            newerDraft.currentVersion.id,
        );
        expect((await getBankQuestionDetail(created.id, null, sql))?.publishedVersion.id).toBe(
            revised.currentVersion.id,
        );
        expect(
            (await getPublishedQuestionVersions(created.id, null, sql)).map((v) => v.id),
        ).toEqual([revised.currentVersion.id]);
        await expect(
            publishQuestionInTransaction(created.id, ownerId, revised.currentVersion.id, sql),
        ).rejects.toMatchObject({ code: "STALE_QUESTION_VERSION" });

        await database.exec("BEGIN");
        await publishQuestionInTransaction(created.id, ownerId, newerDraft.currentVersion.id, sql);
        await database.exec("COMMIT");
        expect(
            (await getPublishedQuestionVersions(created.id, null, sql)).map((v) => v.id),
        ).toEqual([newerDraft.currentVersion.id, revised.currentVersion.id]);

        await database.exec("BEGIN");
        await updateQuestionMetadataInTransaction(
            created.id,
            ownerId,
            { visibility: "unlisted" },
            sql,
        );
        await database.exec("COMMIT");

        expect(await getBankQuestionDetail(created.id, null, sql)).not.toBeNull();
        expect(
            (await listQuestions({ viewerId: null, limit: 50, offset: 0 }, sql)).items,
        ).toHaveLength(0);

        await database.exec("BEGIN");
        await archiveQuestionInTransaction(created.id, ownerId, sql);
        await database.exec("COMMIT");

        expect(await getBankQuestionDetail(created.id, null, sql)).toBeNull();
        await expect(
            createQuestionVersionInTransaction(created.id, ownerId, firstContent, sql),
        ).rejects.toMatchObject({ code: "QUESTION_ARCHIVED" });
        expect(await getQuestionDetail(created.id, ownerId, sql)).not.toBeNull();
        await database.exec("BEGIN");
        await restoreQuestionInTransaction(created.id, ownerId, sql);
        await database.exec("COMMIT");
        expect(await getBankQuestionDetail(created.id, null, sql)).not.toBeNull();
        await database.exec("BEGIN");
        await unpublishQuestionInTransaction(created.id, ownerId, sql);
        await database.exec("COMMIT");
        expect(await getBankQuestionDetail(created.id, null, sql)).toBeNull();
    });

    it("enforces owner-scoped tags and filters the question bank", async () => {
        await database.exec("BEGIN");
        const question = await createQuestionInTransaction(
            ownerId,
            { content: firstContent, visibility: "public" },
            sql,
        );
        await publishQuestionInTransaction(question.id, ownerId, question.currentVersion.id, sql);
        await database.exec("COMMIT");

        const tag = await createTag(ownerId, "Memory Recall", sql);
        const otherTag = await createTag(otherId, "Memory Recall", sql);
        expect(tag.slug).toBe("memory-recall");
        expect((await listTags(ownerId, sql)).map((value) => value.id)).toEqual([tag.id]);
        await expect(createTag(ownerId, "Memory Recall", sql)).rejects.toMatchObject({
            code: "TAG_ALREADY_EXISTS",
        });

        await database.exec("BEGIN");
        const tagged = await assignQuestionTagInTransaction(question.id, tag.id, ownerId, sql);
        await database.exec("COMMIT");
        expect(tagged.tags.map((value) => value.id)).toEqual([tag.id]);
        expect(tagged.currentVersion.id).toBe(question.currentVersion.id);
        expect(await getQuestionVersions(question.id, ownerId, sql)).toHaveLength(1);

        await database.exec("BEGIN");
        await assignQuestionTagInTransaction(question.id, tag.id, ownerId, sql);
        await database.exec("COMMIT");
        expect(
            (
                await listQuestions(
                    { viewerId: null, tagSlug: tag.slug, limit: 50, offset: 0 },
                    sql,
                )
            ).items.map((value) => value.id),
        ).toContain(question.id);

        await expect(
            assignQuestionTagInTransaction(question.id, otherTag.id, ownerId, sql),
        ).rejects.toMatchObject({ code: "TAG_NOT_FOUND" });
        await expect(
            assignQuestionTagInTransaction(question.id, tag.id, otherId, sql),
        ).rejects.toMatchObject({ code: "QUESTION_NOT_FOUND" });

        await database.exec("BEGIN");
        await removeQuestionTagInTransaction(question.id, tag.id, ownerId, sql);
        await database.exec("COMMIT");
        expect(
            (await listQuestions({ viewerId: null, tagSlug: tag.slug, limit: 50, offset: 0 }, sql))
                .items,
        ).toHaveLength(0);
    });
});
