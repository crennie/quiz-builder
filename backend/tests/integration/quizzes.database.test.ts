import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
    createQuestionInTransaction,
    createQuestionVersionInTransaction,
    createTag,
    updateQuestionMetadataInTransaction,
    type QueryExecutor,
} from "../../src/db/question-bank.ts";
import {
    assignQuizTagInTransaction,
    createQuizInTransaction,
    getQuizDetail,
    getQuizVersions,
    listQuizzes,
    removeQuizTagInTransaction,
    saveQuizContentInTransaction,
    updateQuizMetadataInTransaction,
} from "../../src/db/quizzes.ts";

const ownerId = "00000000-0000-4000-8000-000000000201";
const otherId = "00000000-0000-4000-8000-000000000202";
const questionContent = {
    prompt: "What is two plus two?",
    questionType: "exact_text" as const,
    answerConfig: { questionType: "exact_text" as const, acceptedAnswers: ["4"] },
    gradingConfig: {
        questionType: "exact_text" as const,
        caseSensitive: false,
        trimWhitespace: true,
    },
    explanation: "Four.",
};
const settings = { shuffleQuestions: false, showAnswersAfterCompletion: true };

describe("quiz persistence", () => {
    let database: PGlite;
    let sql: QueryExecutor;

    beforeAll(async () => {
        database = new PGlite();
        sql = database as unknown as QueryExecutor;
        const migration = readFileSync(
            resolve(
                import.meta.dirname,
                "../../../supabase/migrations/20260928174208_initial_schema.sql",
            ),
            "utf8",
        );
        await database.exec("CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY)");
        await database.exec(migration);
        for (const id of [ownerId, otherId]) {
            await database.query("INSERT INTO auth.users (id) VALUES ($1)", [id]);
            await database.query(
                "INSERT INTO public.profiles (id, display_name) VALUES ($1, 'Test User')",
                [id],
            );
        }
    });
    afterAll(async () => database.close());
    beforeEach(async () => database.exec("BEGIN"));
    afterEach(async () => database.exec("ROLLBACK"));

    async function makeQuestion(
        userId = ownerId,
        visibility: "private" | "public" | "unlisted" = "private",
    ) {
        return createQuestionInTransaction(
            userId,
            {
                content: questionContent,
                visibility,
                status: "published",
            },
            sql,
        );
    }

    it("creates versions only for changed attempt content and preserves explicit source versions", async () => {
        const first = await makeQuestion();
        const second = await makeQuestion();
        const firstMember = {
            questionId: first.id,
            questionVersionId: first.currentVersion.id,
            points: 2.5,
            required: true,
            timeLimitSeconds: null,
        };
        const secondMember = {
            questionId: second.id,
            questionVersionId: second.currentVersion.id,
            points: 0.25,
            required: false,
            timeLimitSeconds: 30,
        };
        const base = { title: "Math", description: null, settings, questions: [firstMember] };
        const created = await createQuizInTransaction(
            ownerId,
            {
                content: base,
                visibility: "private",
                status: "draft",
            },
            sql,
        );
        expect(created.currentVersion.versionNumber).toBe(1);
        expect(created.currentVersion.questions[0]).toMatchObject({ ...firstMember, position: 0 });
        expect(await getQuizDetail(created.id, otherId, sql)).toBeNull();

        const same = await saveQuizContentInTransaction(
            created.id,
            ownerId,
            {
                ...base,
                title: " Math ",
                settings: { ...settings },
            },
            sql,
        );
        expect(same.currentVersion.id).toBe(created.currentVersion.id);
        expect(await getQuizVersions(created.id, ownerId, sql)).toHaveLength(1);

        const added = await saveQuizContentInTransaction(
            created.id,
            ownerId,
            {
                ...base,
                questions: [firstMember, secondMember],
            },
            sql,
        );
        expect(added.currentVersion.versionNumber).toBe(2);
        expect(added.currentVersion.questions.map((question) => question.position)).toEqual([0, 1]);

        const reordered = await saveQuizContentInTransaction(
            created.id,
            ownerId,
            {
                ...base,
                questions: [secondMember, firstMember],
            },
            sql,
        );
        expect(reordered.currentVersion.versionNumber).toBe(3);

        const reweighted = await saveQuizContentInTransaction(
            created.id,
            ownerId,
            {
                ...base,
                questions: [
                    { ...secondMember, points: 1, required: true, timeLimitSeconds: 60 },
                    firstMember,
                ],
            },
            sql,
        );
        expect(reweighted.currentVersion.versionNumber).toBe(4);

        const changedSettings = await saveQuizContentInTransaction(
            created.id,
            ownerId,
            {
                ...base,
                settings: { ...settings, shuffleQuestions: true },
                questions: [
                    { ...secondMember, points: 1, required: true, timeLimitSeconds: 60 },
                    firstMember,
                ],
            },
            sql,
        );
        expect(changedSettings.currentVersion.versionNumber).toBe(5);

        const revisedQuestion = await createQuestionVersionInTransaction(
            first.id,
            ownerId,
            {
                ...questionContent,
                prompt: "What is 2 + 2?",
            },
            sql,
        );
        expect((await getQuizDetail(created.id, ownerId, sql))?.currentVersion.id).toBe(
            changedSettings.currentVersion.id,
        );
        expect(
            (await getQuizDetail(created.id, ownerId, sql))?.currentVersion.questions[1]?.question
                .prompt,
        ).toBe(questionContent.prompt);

        const upgraded = await saveQuizContentInTransaction(
            created.id,
            ownerId,
            {
                ...base,
                settings: { ...settings, shuffleQuestions: true },
                questions: [
                    { ...secondMember, points: 1, required: true, timeLimitSeconds: 60 },
                    { ...firstMember, questionVersionId: revisedQuestion.currentVersion.id },
                ],
            },
            sql,
        );
        expect(upgraded.currentVersion.versionNumber).toBe(6);
        expect(upgraded.currentVersion.questions[1]?.question.prompt).toBe("What is 2 + 2?");

        const removed = await saveQuizContentInTransaction(
            created.id,
            ownerId,
            {
                ...base,
                questions: [firstMember],
            },
            sql,
        );
        expect(removed.currentVersion.versionNumber).toBe(7);
        expect(removed.currentVersion.questions).toHaveLength(1);
        const history = await getQuizVersions(created.id, ownerId, sql);
        expect(history).toHaveLength(7);
        expect(history.at(-1)?.questions[0]?.questionVersionId).toBe(first.currentVersion.id);
        await expect(
            database.query("UPDATE public.quiz_versions SET title = 'changed' WHERE id = $1", [
                created.currentVersion.id,
            ]),
        ).rejects.toThrow();
        await expect(
            database.query(
                "UPDATE public.quiz_version_questions SET points = 100 WHERE quiz_version_id = $1",
                [created.currentVersion.id],
            ),
        ).rejects.toThrow();
    });

    it("enforces quiz visibility and keeps metadata and tags out of content versions", async () => {
        const question = await makeQuestion();
        const content = {
            title: "Study",
            description: "Practice",
            settings,
            questions: [
                {
                    questionId: question.id,
                    questionVersionId: question.currentVersion.id,
                    points: 1,
                    required: true,
                    timeLimitSeconds: null,
                },
            ],
        };
        const quiz = await createQuizInTransaction(
            ownerId,
            {
                content,
                visibility: "private",
                status: "draft",
            },
            sql,
        );
        expect(await getQuizDetail(quiz.id, null, sql)).toBeNull();
        await expect(getQuizVersions(quiz.id, otherId, sql)).rejects.toMatchObject({
            code: "QUIZ_NOT_FOUND",
        });
        await expect(
            saveQuizContentInTransaction(quiz.id, otherId, content, sql),
        ).rejects.toMatchObject({ code: "QUIZ_NOT_FOUND" });
        await expect(
            updateQuizMetadataInTransaction(quiz.id, otherId, { status: "published" }, sql),
        ).rejects.toMatchObject({ code: "QUIZ_NOT_FOUND" });

        const tag = await createTag(ownerId, "Algebra", sql);
        const otherTag = await createTag(otherId, "Other", sql);
        await expect(
            assignQuizTagInTransaction(quiz.id, otherTag.id, ownerId, sql),
        ).rejects.toMatchObject({ code: "TAG_NOT_FOUND" });
        const tagged = await assignQuizTagInTransaction(quiz.id, tag.id, ownerId, sql);
        expect(tagged.tags.map((item) => item.id)).toEqual([tag.id]);
        expect(tagged.currentVersion.id).toBe(quiz.currentVersion.id);
        const published = await updateQuizMetadataInTransaction(
            quiz.id,
            ownerId,
            {
                visibility: "public",
                status: "published",
            },
            sql,
        );
        expect(published.currentVersion.id).toBe(quiz.currentVersion.id);
        expect(
            (await getQuizDetail(quiz.id, null, sql))?.currentVersion.questions[0]?.question
                .answerConfig,
        ).toEqual(questionContent.answerConfig);
        expect(
            (await listQuizzes({ viewerId: null, tagSlug: tag.slug, limit: 20, offset: 0 }, sql))
                .items,
        ).toHaveLength(1);
        await updateQuizMetadataInTransaction(quiz.id, ownerId, { visibility: "unlisted" }, sql);
        expect(await getQuizDetail(quiz.id, null, sql)).not.toBeNull();
        expect(
            (await listQuizzes({ viewerId: null, limit: 20, offset: 0 }, sql)).items,
        ).toHaveLength(0);
        await removeQuizTagInTransaction(quiz.id, tag.id, ownerId, sql);
        expect((await getQuizDetail(quiz.id, ownerId, sql))?.tags).toEqual([]);
        await updateQuizMetadataInTransaction(quiz.id, ownerId, { status: "archived" }, sql);
        expect(await getQuizDetail(quiz.id, null, sql)).toBeNull();
        expect(await getQuizVersions(quiz.id, ownerId, sql)).toHaveLength(1);
        await expect(
            saveQuizContentInTransaction(quiz.id, ownerId, content, sql),
        ).rejects.toMatchObject({ code: "QUIZ_ARCHIVED" });
    });

    it("checks membership identity and source availability without hiding included content", async () => {
        const privateQuestion = await makeQuestion(otherId);
        const publicQuestion = await makeQuestion(otherId, "public");
        const unlistedQuestion = await makeQuestion(otherId, "unlisted");
        const member = (question: typeof privateQuestion) => ({
            questionId: question.id,
            questionVersionId: question.currentVersion.id,
            points: 1,
            required: true,
            timeLimitSeconds: null,
        });
        const content = {
            title: "Shared",
            description: null,
            settings,
            questions: [member(publicQuestion), member(unlistedQuestion)],
        };
        const quiz = await createQuizInTransaction(
            ownerId,
            {
                content,
                visibility: "public",
                status: "published",
            },
            sql,
        );
        expect((await getQuizDetail(quiz.id, null, sql))?.currentVersion.questions).toHaveLength(2);
        await expect(
            createQuizInTransaction(
                ownerId,
                {
                    content: { ...content, questions: [member(privateQuestion)] },
                    visibility: "private",
                    status: "draft",
                },
                sql,
            ),
        ).rejects.toMatchObject({ code: "QUESTION_VERSION_NOT_FOUND" });
        await expect(
            saveQuizContentInTransaction(
                quiz.id,
                ownerId,
                {
                    ...content,
                    questions: [{ ...member(publicQuestion), questionId: privateQuestion.id }],
                },
                sql,
            ),
        ).rejects.toMatchObject({ code: "QUESTION_VERSION_NOT_FOUND" });

        await updateQuestionMetadataInTransaction(
            publicQuestion.id,
            otherId,
            { visibility: "private" },
            sql,
        );
        expect(
            (await getQuizDetail(quiz.id, null, sql))?.currentVersion.questions[0]?.question.prompt,
        ).toBe(questionContent.prompt);
        const reordered = await saveQuizContentInTransaction(
            quiz.id,
            ownerId,
            {
                ...content,
                questions: [member(unlistedQuestion), member(publicQuestion)],
            },
            sql,
        );
        expect(reordered.currentVersion.versionNumber).toBe(2);
        await updateQuestionMetadataInTransaction(
            publicQuestion.id,
            otherId,
            { status: "archived" },
            sql,
        );
        const renamed = await saveQuizContentInTransaction(
            quiz.id,
            ownerId,
            {
                ...content,
                title: "Shared study",
                questions: [member(unlistedQuestion), member(publicQuestion)],
            },
            sql,
        );
        expect(renamed.currentVersion.versionNumber).toBe(3);
        expect(
            (await getQuizDetail(quiz.id, null, sql))?.currentVersion.questions[1]?.question.prompt,
        ).toBe(questionContent.prompt);
    });

    it("allows empty drafts but refuses to publish an empty quiz", async () => {
        const content = { title: "Later", description: null, settings, questions: [] };
        const quiz = await createQuizInTransaction(
            ownerId,
            {
                content,
                visibility: "private",
                status: "draft",
            },
            sql,
        );
        await expect(
            updateQuizMetadataInTransaction(quiz.id, ownerId, { status: "published" }, sql),
        ).rejects.toMatchObject({ code: "EMPTY_QUIZ" });
        await expect(
            createQuizInTransaction(
                ownerId,
                {
                    content,
                    visibility: "public",
                    status: "published",
                },
                sql,
            ),
        ).rejects.toMatchObject({ code: "EMPTY_QUIZ" });
    });
});
