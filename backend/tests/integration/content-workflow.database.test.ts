import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyMigrations } from "./apply-migrations.ts";
import {
    createQuestionInTransaction,
    createQuestionVersionInTransaction,
    getBankQuestionDetail,
    publishQuestionInTransaction,
    type QueryExecutor,
} from "../../src/db/question-bank.ts";
import {
    claimWorkItemInTransaction,
    decideWorkItemInTransaction,
    failWorkItemInTransaction,
    listWorkItems,
    submitQuestionReviewInTransaction,
} from "../../src/db/content-workflow.ts";

const owner = "00000000-0000-4000-8000-000000000201";
const stranger = "00000000-0000-4000-8000-000000000202";
const content = {
    prompt: "Which planet is third from the Sun?",
    questionType: "exact_text" as const,
    answerConfig: { questionType: "exact_text" as const, acceptedAnswers: ["Earth"] },
    gradingConfig: {
        questionType: "exact_text" as const,
        caseSensitive: false,
        trimWhitespace: true,
    },
    explanation: null,
};

describe("human content workflow", () => {
    let db: PGlite;
    let sql: QueryExecutor;
    beforeAll(async () => {
        db = new PGlite();
        sql = db as unknown as QueryExecutor;
        await db.exec("CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY)");
        await applyMigrations((migration) => db.exec(migration));
        for (const id of [owner, stranger]) {
            await db.query("INSERT INTO auth.users (id) VALUES ($1)", [id]);
            await db.query("INSERT INTO public.profiles (id, display_name) VALUES ($1, 'Tester')", [
                id,
            ]);
        }
    });
    afterAll(async () => {
        await db.close();
    });

    it("keeps approved content unpublished until a fenced gate approval", async () => {
        const question = await createQuestionInTransaction(
            owner,
            { content, visibility: "public" },
            sql,
        );
        const versionId = question.currentVersion.id;
        await expect(
            submitQuestionReviewInTransaction(question.id, versionId, stranger, sql),
        ).rejects.toMatchObject({ code: "QUESTION_NOT_FOUND" });
        const review = await submitQuestionReviewInTransaction(question.id, versionId, owner, sql);
        expect(
            (await submitQuestionReviewInTransaction(question.id, versionId, owner, sql)).id,
        ).toBe(review.id);
        await expect(
            publishQuestionInTransaction(question.id, owner, versionId, sql),
        ).rejects.toMatchObject({ code: "REVIEW_REQUIRED" });
        expect(await getBankQuestionDetail(question.id, null, sql)).toBeNull();
        await expect(claimWorkItemInTransaction(review.id, stranger, sql)).rejects.toMatchObject({
            code: "WORK_ITEM_NOT_FOUND",
        });
        const firstClaim = await claimWorkItemInTransaction(review.id, owner, sql);
        await failWorkItemInTransaction(review.id, owner, firstClaim.claimToken!, "retry", sql);
        const secondClaim = await claimWorkItemInTransaction(review.id, owner, sql);
        await expect(
            decideWorkItemInTransaction(
                review.id,
                owner,
                firstClaim.claimToken!,
                "approved",
                "",
                sql,
            ),
        ).rejects.toMatchObject({ code: "STALE_WORK_ITEM_CLAIM" });
        await decideWorkItemInTransaction(
            review.id,
            owner,
            secondClaim.claimToken!,
            "approved",
            "",
            sql,
        );
        const gates = (await listWorkItems(owner, sql)).items.filter(
            (item) => item.itemType === "APPROVE_PUBLICATION" && item.questionId === question.id,
        );
        expect(gates).toHaveLength(1);
        expect(gates[0]?.status).toBe("pending");
        expect(await getBankQuestionDetail(question.id, null, sql)).toBeNull();
        const gate = await claimWorkItemInTransaction(gates[0].id, owner, sql);
        await decideWorkItemInTransaction(
            gate.id,
            owner,
            gate.claimToken!,
            "approve_and_publish",
            "",
            sql,
        );
        await decideWorkItemInTransaction(
            gate.id,
            owner,
            gate.claimToken!,
            "approve_and_publish",
            "",
            sql,
        );
        expect((await getBankQuestionDetail(question.id, null, sql))?.publishedVersion.id).toBe(
            versionId,
        );
        const decisions = await db.query<{ count: number }>(
            `SELECT count(*)::int AS count FROM public.question_publication_gate_decisions
             WHERE work_item_id = $1`,
            [gate.id],
        );
        expect(decisions.rows[0]?.count).toBe(1);
    });

    it("requires a new version after changes and cancels stale work", async () => {
        const question = await createQuestionInTransaction(
            owner,
            { content: { ...content, prompt: "Original" }, visibility: "private" },
            sql,
        );
        const review = await submitQuestionReviewInTransaction(
            question.id,
            question.currentVersion.id,
            owner,
            sql,
        );
        const claim = await claimWorkItemInTransaction(review.id, owner, sql);
        await decideWorkItemInTransaction(
            review.id,
            owner,
            claim.claimToken!,
            "changes_requested",
            "Clarify the wording",
            sql,
        );
        const revision = (await listWorkItems(owner, sql)).items.find(
            (item) => item.itemType === "REVISE_QUESTION" && item.questionId === question.id,
        );
        expect(revision?.status).toBe("pending");
        const next = await createQuestionVersionInTransaction(
            question.id,
            owner,
            { ...content, prompt: "Revised" },
            sql,
        );
        expect(
            (await listWorkItems(owner, sql)).items.find((item) => item.id === revision?.id)
                ?.status,
        ).toBe("cancelled");
        const fresh = await submitQuestionReviewInTransaction(
            question.id,
            next.currentVersion.id,
            owner,
            sql,
        );
        expect(fresh.id).not.toBe(review.id);
        await expect(
            submitQuestionReviewInTransaction(question.id, question.currentVersion.id, owner, sql),
        ).rejects.toMatchObject({
            code: "STALE_QUESTION_VERSION",
        });
    });

    it("rejects expired claims and closes rejected gates without publication", async () => {
        const question = await createQuestionInTransaction(
            owner,
            { content: { ...content, prompt: "Needs a gate" }, visibility: "public" },
            sql,
        );
        const review = await submitQuestionReviewInTransaction(
            question.id,
            question.currentVersion.id,
            owner,
            sql,
        );
        const first = await claimWorkItemInTransaction(review.id, owner, sql);
        await db.query(
            `UPDATE public.work_items SET lease_until = now() - interval '1 second'
            WHERE id = $1`,
            [review.id],
        );
        const second = await claimWorkItemInTransaction(review.id, owner, sql);
        expect(second.claimGeneration).toBe(first.claimGeneration + 1);
        await expect(
            decideWorkItemInTransaction(review.id, owner, first.claimToken!, "approved", "", sql),
        ).rejects.toMatchObject({ code: "STALE_WORK_ITEM_CLAIM" });
        await decideWorkItemInTransaction(
            review.id,
            owner,
            second.claimToken!,
            "approved",
            "",
            sql,
        );
        const gate = (await listWorkItems(owner, sql)).items.find(
            (item) => item.itemType === "APPROVE_PUBLICATION" && item.questionId === question.id,
        )!;
        const gateClaim = await claimWorkItemInTransaction(gate.id, owner, sql);
        await decideWorkItemInTransaction(
            gate.id,
            owner,
            gateClaim.claimToken!,
            "rejected",
            "Incorrect wording",
            sql,
        );
        expect(await getBankQuestionDetail(question.id, null, sql)).toBeNull();
        expect(
            (
                await submitQuestionReviewInTransaction(
                    question.id,
                    question.currentVersion.id,
                    owner,
                    sql,
                )
            ).id,
        ).toBe(review.id);
        const newVersion = await createQuestionVersionInTransaction(
            question.id,
            owner,
            { ...content, prompt: "Correct wording" },
            sql,
        );
        expect(
            (
                await submitQuestionReviewInTransaction(
                    question.id,
                    newVersion.currentVersion.id,
                    owner,
                    sql,
                )
            ).id,
        ).not.toBe(review.id);
    });

    it("stops retrying after three failed claims", async () => {
        const question = await createQuestionInTransaction(
            owner,
            { content: { ...content, prompt: "Retry this review" }, visibility: "private" },
            sql,
        );
        const review = await submitQuestionReviewInTransaction(
            question.id,
            question.currentVersion.id,
            owner,
            sql,
        );
        for (let attempt = 0; attempt < 3; attempt += 1) {
            const claim = await claimWorkItemInTransaction(review.id, owner, sql);
            const returned = await failWorkItemInTransaction(
                review.id,
                owner,
                claim.claimToken!,
                "Temporary problem",
                sql,
            );
            expect(returned.status).toBe(attempt === 2 ? "failed" : "pending");
        }
        await expect(claimWorkItemInTransaction(review.id, owner, sql)).rejects.toMatchObject({
            code: "WORK_ITEM_NOT_CLAIMABLE",
        });
    });
});
