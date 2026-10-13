import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDatabase, transaction, owner, other, content, quizContent } from "./v1-fixtures.ts";
import {
    createQuestionInTransaction,
    saveQuestionContentInTransaction,
    getQuestionDetail,
    listManagedQuestions,
    createTag,
    listTags,
    assignQuestionTagInTransaction,
    removeQuestionTagInTransaction,
} from "../../src/db/question-bank.ts";
import { createQuizInTransaction, saveQuizContentInTransaction } from "../../src/db/quizzes.ts";
describe("direct questions", () => {
    let state: Awaited<ReturnType<typeof testDatabase>>;
    beforeAll(async () => {
        state = await testDatabase();
    });
    afterAll(async () => state.db.close());
    it("creates private content, edits before use, and enforces owner/public access", async () => {
        const { sql } = state;
        const q = await createQuestionInTransaction(owner, { content }, sql);
        expect(q).toMatchObject({
            visibility: "private",
            canEditContent: true,
            contentLockedAt: null,
        });
        expect(await getQuestionDetail(q.id, other, sql)).toBeNull();
        expect(await getQuestionDetail(q.id, null, sql)).toBeNull();
        await expect(
            saveQuestionContentInTransaction(q.id, other, content, sql),
        ).rejects.toMatchObject({ code: "QUESTION_NOT_FOUND" });
        const changed = await saveQuestionContentInTransaction(
            q.id,
            owner,
            { ...content, prompt: "Changed" },
            sql,
        );
        expect(changed.prompt).toBe("Changed");
        await sql.query("UPDATE public.questions SET visibility='public' WHERE id=$1", [q.id]);
        expect(await getQuestionDetail(q.id, null, sql)).toMatchObject({
            prompt: "Changed",
            isOwner: false,
            canEditContent: false,
        });
        await expect(
            saveQuestionContentInTransaction(q.id, owner, content, sql),
        ).rejects.toMatchObject({ code: "PUBLIC_CONTENT_READ_ONLY" });
    });
    it("permanently locks question content on first composition use, even after removal", async () => {
        const { db, sql } = state;
        const q = await createQuestionInTransaction(owner, { content }, sql);
        const input = quizContent(q.id);
        const quiz = await transaction(db, () =>
            createQuizInTransaction(owner, { content: input }, sql),
        );
        expect(await getQuestionDetail(q.id, owner, sql)).toMatchObject({ canEditContent: false });
        await transaction(db, () =>
            saveQuizContentInTransaction(quiz.id, owner, { ...input, questions: [] }, sql),
        );
        await expect(
            saveQuestionContentInTransaction(q.id, owner, { ...content, prompt: "Mutation" }, sql),
        ).rejects.toMatchObject({ code: "QUESTION_CONTENT_LOCKED" });
        expect((await saveQuestionContentInTransaction(q.id, owner, content, sql)).prompt).toBe(
            content.prompt,
        );
        for (const set of [
            "content_locked_at=NULL",
            "prompt='Bypass'",
            "explanation='Bypass'",
            "answer_config='{}'",
            "grading_config='{}'",
            "question_type='multiple_choice_single'",
        ])
            await expect(
                sql.query(`UPDATE public.questions SET ${set} WHERE id=$1`, [q.id]),
            ).rejects.toMatchObject({ code: "23514" });
    });
    it("keeps tags editable under ownership and filters the personal list", async () => {
        const { sql } = state;
        const q = await createQuestionInTransaction(owner, { content }, sql);
        const tag = await createTag(owner, "Memory Recall", sql);
        const foreign = await createTag(other, "Memory Recall", sql);
        expect(tag.slug).toBe("memory-recall");
        expect(await listTags(owner, sql)).toContainEqual(tag);
        await expect(createTag(owner, tag.name, sql)).rejects.toMatchObject({
            code: "TAG_ALREADY_EXISTS",
        });
        expect((await assignQuestionTagInTransaction(q.id, tag.id, owner, sql)).tags).toEqual([
            tag,
        ]);
        await expect(
            assignQuestionTagInTransaction(q.id, foreign.id, owner, sql),
        ).rejects.toMatchObject({ code: "TAG_NOT_FOUND" });
        await expect(
            assignQuestionTagInTransaction(q.id, tag.id, other, sql),
        ).rejects.toMatchObject({ code: "QUESTION_NOT_FOUND" });
        expect(
            (
                await listManagedQuestions(
                    { ownerId: owner, tagSlug: tag.slug, limit: 50, offset: 0 },
                    sql,
                )
            ).items.map((q) => q.id),
        ).toEqual([q.id]);
        await removeQuestionTagInTransaction(q.id, tag.id, owner, sql);
        expect((await getQuestionDetail(q.id, owner, sql))?.tags).toEqual([]);
    });
});
