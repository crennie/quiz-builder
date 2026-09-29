import { PGlite } from "@electric-sql/pglite";
import type {
    AttemptDetail,
    Feedback,
    QuestionDetail,
    QuizDetail,
    Tag,
} from "@quiz-builder/contracts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { verifyAccessToken } from "../../src/auth/supabase.ts";

const databaseState = vi.hoisted(() => ({ current: null as PGlite | null }));

vi.mock("../../src/auth/supabase.ts", () => ({ verifyAccessToken: vi.fn() }));
vi.mock("../../src/db/index.ts", () => {
    const query = (sql: string, values?: unknown[]) => {
        if (!databaseState.current) throw new Error("Test database is unavailable");
        return databaseState.current.query(sql, values);
    };
    return {
        pool: {
            query,
            connect: () => Promise.resolve({ query, release: () => undefined }),
        },
    };
});

import { app } from "../../src/app.ts";

const authorId = "00000000-0000-4000-8000-000000000501";
const learnerId = "00000000-0000-4000-8000-000000000502";
const outsiderId = "00000000-0000-4000-8000-000000000503";
const users = { author: authorId, learner: learnerId, outsider: outsiderId };
const questionContent = {
    prompt: "Capital of France?",
    questionType: "exact_text",
    answerConfig: { questionType: "exact_text", acceptedAnswers: ["Paris"] },
    gradingConfig: { questionType: "exact_text", caseSensitive: false, trimWhitespace: true },
    explanation: "Paris is the capital.",
};
const settings = { shuffleQuestions: false, showAnswersAfterCompletion: true };

type Method = "get" | "post" | "put" | "patch" | "delete";
type Page<T> = { items: T[]; nextOffset: number | null };
type ErrorBody = { error: { code: string; message: string } };

async function call<Body = unknown>(
    method: Method,
    path: string,
    user?: keyof typeof users,
    body?: object,
): Promise<{ status: number; body: Body }> {
    const outgoing = request(app)[method](`/api/v1${path}`);
    if (user) outgoing.set("Authorization", `Bearer ${user}`);
    if (body) outgoing.send(body);
    const response = await outgoing;
    const responseBody: unknown = response.body;
    return { status: response.status, body: responseBody as Body };
}

async function fixture() {
    const questionResponse = await call<QuestionDetail>("post", "/questions", "author", {
        content: questionContent,
        visibility: "public",
        status: "published",
    });
    expect(questionResponse.status).toBe(201);
    const question = questionResponse.body;
    const content = {
        title: "Geography practice",
        description: null,
        settings,
        questions: [
            {
                questionId: question.id,
                questionVersionId: question.currentVersion.id,
                points: 2.5,
                required: true,
                timeLimitSeconds: null,
            },
        ],
    };
    const quizResponse = await call<QuizDetail>("post", "/quizzes", "author", {
        content,
        visibility: "public",
        status: "published",
    });
    expect(quizResponse.status).toBe(201);
    return { question, quiz: quizResponse.body, content };
}

describe("HTTP and database core workflows", () => {
    beforeEach(async () => {
        const database = new PGlite();
        databaseState.current = database;
        await database.exec("CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY)");
        await database.exec(
            readFileSync(
                resolve(
                    import.meta.dirname,
                    "../../../supabase/migrations/20260928174208_initial_schema.sql",
                ),
                "utf8",
            ),
        );
        for (const id of Object.values(users)) {
            await database.query("INSERT INTO auth.users (id) VALUES ($1)", [id]);
        }
        vi.resetAllMocks();
        vi.mocked(verifyAccessToken).mockImplementation((token) => {
            const id = users[token as keyof typeof users];
            if (!id) throw new Error("Unexpected test token");
            return Promise.resolve({ id, userMetadata: { display_name: token } });
        });
    });

    afterEach(async () => {
        await databaseState.current?.close();
        databaseState.current = null;
    });

    it("runs authoring, practice, historical versioning, and feedback through HTTP and SQL", async () => {
        const { question, quiz, content } = await fixture();
        const start = await call<AttemptDetail>("post", `/quizzes/${quiz.id}/attempts`, "learner");
        expect(start.status).toBe(201);
        expect(start.body.questions).toHaveLength(1);
        expect(start.body.questions[0].correctAnswer).toBeNull();

        const attemptId = start.body.id;
        const attemptQuestionId = start.body.questions[0].id;
        const answer = await call<AttemptDetail>(
            "put",
            `/attempts/${attemptId}/questions/${attemptQuestionId}/answer`,
            "learner",
            { response: { questionType: "exact_text", text: " paris " } },
        );
        expect(answer.status).toBe(200);
        expect(answer.body.questions[0].evaluationResult).toBeNull();
        const completed = await call<AttemptDetail>(
            "post",
            `/attempts/${attemptId}/complete`,
            "learner",
        );
        expect(completed.status).toBe(200);
        expect(completed.body.scoreSummary).toEqual({ pointsPossible: 2.5, pointsAwarded: 2.5 });
        expect(completed.body.questions[0].correctAnswer).toEqual(questionContent.answerConfig);

        const revision = await call<QuestionDetail>(
            "post",
            `/questions/${question.id}/versions`,
            "author",
            {
                ...questionContent,
                prompt: "Capital of the UK?",
                answerConfig: { questionType: "exact_text", acceptedAnswers: ["London"] },
            },
        );
        expect(revision.status).toBe(201);
        expect(
            (await call<QuizDetail>("get", `/quizzes/${quiz.id}`)).body.currentVersion.questions[0]
                ?.question.prompt,
        ).toBe(questionContent.prompt);
        const upgraded = await call<QuizDetail>("put", `/quizzes/${quiz.id}/content`, "author", {
            ...content,
            questions: [
                { ...content.questions[0], questionVersionId: revision.body.currentVersion.id },
            ],
        });
        expect(upgraded.status).toBe(200);
        expect(upgraded.body.currentVersion.versionNumber).toBe(2);

        const historical = await call<AttemptDetail>("get", `/attempts/${attemptId}`, "learner");
        expect(historical.body.quizVersionId).toBe(quiz.currentVersion.id);
        expect(historical.body.questions[0].prompt).toBe(questionContent.prompt);
        expect(historical.body.scoreSummary).toEqual(completed.body.scoreSummary);
        expect(
            (await call<Page<AttemptDetail>>("get", "/attempts", "learner")).body.items[0]?.id,
        ).toBe(attemptId);

        const submitted = await call<Feedback>("post", "/feedback", "learner", {
            quizAttemptQuestionId: attemptQuestionId,
            category: "other",
            comment: "Useful practice",
        });
        expect(submitted.status).toBe(201);
        const received = await call<Page<Feedback>>("get", "/feedback/received", "author");
        expect(received.body.items[0]?.id).toBe(submitted.body.id);
        const reviewed = await call<Feedback>("patch", `/feedback/${submitted.body.id}`, "author", {
            status: "reviewed",
        });
        expect(reviewed.status).toBe(200);
        expect(reviewed.body.reviewedAt).not.toBeNull();
    });

    it("applies an HTTP authorization matrix to protected reads and mutations", async () => {
        const { question, quiz, content } = await fixture();
        const tag = await call<Tag>("post", "/tags", "author", { name: "Geography" });
        expect(tag.status).toBe(201);
        const started = await call<AttemptDetail>(
            "post",
            `/quizzes/${quiz.id}/attempts`,
            "learner",
        );
        expect(started.status).toBe(201);
        const feedback = await call<Feedback>("post", "/feedback", "learner", {
            quizId: quiz.id,
            category: "other",
            comment: "Good quiz",
        });
        expect(feedback.status).toBe(201);

        const entryPoints: { method: Method; path: string; body?: object }[] = [
            { method: "get", path: "/me" },
            { method: "get", path: "/tags" },
            { method: "post", path: "/tags", body: { name: "Another tag" } },
            { method: "post", path: "/questions", body: { content: questionContent } },
            { method: "post", path: "/quizzes", body: { content } },
            { method: "post", path: `/quizzes/${quiz.id}/attempts` },
            { method: "get", path: "/attempts" },
            {
                method: "post",
                path: "/feedback",
                body: { quizId: quiz.id, category: "other", comment: "Comment" },
            },
            { method: "get", path: "/feedback/received" },
        ];
        for (const item of entryPoints) {
            const anonymous = await call(item.method, item.path, undefined, item.body);
            expect(anonymous.status, `${item.method} ${item.path} anonymous`).toBe(401);
        }

        const cases: {
            method: Method;
            path: string;
            owner: keyof typeof users;
            body?: object;
            allowed: number;
        }[] = [
            {
                method: "get",
                path: `/questions/${question.id}/versions`,
                owner: "author",
                allowed: 200,
            },
            {
                method: "post",
                path: `/questions/${question.id}/versions`,
                owner: "author",
                body: questionContent,
                allowed: 201,
            },
            {
                method: "patch",
                path: `/questions/${question.id}`,
                owner: "author",
                body: { visibility: "public" },
                allowed: 200,
            },
            {
                method: "put",
                path: `/questions/${question.id}/tags/${tag.body.id}`,
                owner: "author",
                allowed: 200,
            },
            {
                method: "delete",
                path: `/questions/${question.id}/tags/${tag.body.id}`,
                owner: "author",
                allowed: 204,
            },
            { method: "get", path: `/quizzes/${quiz.id}/versions`, owner: "author", allowed: 200 },
            {
                method: "put",
                path: `/quizzes/${quiz.id}/content`,
                owner: "author",
                body: content,
                allowed: 200,
            },
            {
                method: "patch",
                path: `/quizzes/${quiz.id}`,
                owner: "author",
                body: { visibility: "public" },
                allowed: 200,
            },
            { method: "post", path: `/quizzes/${quiz.id}/publish`, owner: "author", allowed: 200 },
            {
                method: "put",
                path: `/quizzes/${quiz.id}/tags/${tag.body.id}`,
                owner: "author",
                allowed: 200,
            },
            {
                method: "delete",
                path: `/quizzes/${quiz.id}/tags/${tag.body.id}`,
                owner: "author",
                allowed: 204,
            },
            { method: "get", path: `/attempts/${started.body.id}`, owner: "learner", allowed: 200 },
            {
                method: "put",
                path: `/attempts/${started.body.id}/questions/${started.body.questions[0].id}/answer`,
                owner: "learner",
                body: { response: { questionType: "exact_text", text: "Paris" } },
                allowed: 200,
            },
            {
                method: "post",
                path: `/attempts/${started.body.id}/complete`,
                owner: "learner",
                allowed: 200,
            },
            {
                method: "patch",
                path: `/feedback/${feedback.body.id}`,
                owner: "author",
                body: { status: "reviewed" },
                allowed: 200,
            },
            {
                method: "post",
                path: `/questions/${question.id}/archive`,
                owner: "author",
                allowed: 200,
            },
            { method: "post", path: `/quizzes/${quiz.id}/archive`, owner: "author", allowed: 200 },
        ];

        for (const item of cases) {
            const unauthenticated = await call(item.method, item.path, undefined, item.body);
            expect(unauthenticated.status, `${item.method} ${item.path} anonymous`).toBe(401);
            const other = item.owner === "learner" ? "author" : "outsider";
            const forbidden = await call(item.method, item.path, other, item.body);
            expect(forbidden.status, `${item.method} ${item.path} other user`).toBe(404);
            const allowed = await call(item.method, item.path, item.owner, item.body);
            expect(allowed.status, `${item.method} ${item.path} owner`).toBe(item.allowed);
        }

        expect(
            (await call<Page<AttemptDetail>>("get", "/attempts", "outsider")).body.items,
        ).toEqual([]);
        expect(
            (await call<Page<Feedback>>("get", "/feedback/received", "outsider")).body.items,
        ).toEqual([]);
        expect((await call<{ tags: Tag[] }>("get", "/tags", "outsider")).body.tags).toEqual([]);
    });

    it("applies public, unlisted, private, and archived read rules at the API boundary", async () => {
        const { question, quiz } = await fixture();
        expect((await call("get", `/questions/${question.id}`)).status).toBe(200);
        expect((await call("get", `/quizzes/${quiz.id}`)).status).toBe(200);
        expect((await call<Page<QuestionDetail>>("get", "/questions")).body.items).toHaveLength(1);
        expect((await call<Page<QuizDetail>>("get", "/quizzes")).body.items).toHaveLength(1);

        await call("patch", `/questions/${question.id}`, "author", { visibility: "unlisted" });
        await call("patch", `/quizzes/${quiz.id}`, "author", { visibility: "unlisted" });
        expect((await call("get", `/questions/${question.id}`)).status).toBe(200);
        expect((await call("get", `/quizzes/${quiz.id}`)).status).toBe(200);
        expect((await call<Page<QuestionDetail>>("get", "/questions")).body.items).toEqual([]);
        expect((await call<Page<QuizDetail>>("get", "/quizzes")).body.items).toEqual([]);
        expect((await call("post", `/quizzes/${quiz.id}/attempts`, "learner")).status).toBe(201);

        await call("patch", `/questions/${question.id}`, "author", { visibility: "private" });
        await call("patch", `/quizzes/${quiz.id}`, "author", { visibility: "private" });
        expect((await call("get", `/questions/${question.id}`, "outsider")).status).toBe(404);
        expect((await call("get", `/quizzes/${quiz.id}`, "outsider")).status).toBe(404);
        expect((await call("get", `/questions/${question.id}`, "author")).status).toBe(200);
        expect((await call("get", `/quizzes/${quiz.id}`, "author")).status).toBe(200);
        expect((await call("post", `/quizzes/${quiz.id}/attempts`, "learner")).status).toBe(404);

        await call("post", `/questions/${question.id}/archive`, "author");
        await call("post", `/quizzes/${quiz.id}/archive`, "author");
        expect((await call("get", `/questions/${question.id}`)).status).toBe(404);
        expect((await call("get", `/quizzes/${quiz.id}`)).status).toBe(404);
        expect((await call("get", `/questions/${question.id}`, "author")).status).toBe(200);
        expect((await call("get", `/quizzes/${quiz.id}`, "author")).status).toBe(200);
    });

    it("keeps failed answer operations from changing an attempt and honors review settings", async () => {
        const { quiz, content } = await fixture();
        const saved = await call<QuizDetail>("put", `/quizzes/${quiz.id}/content`, "author", {
            ...content,
            settings: { ...settings, showAnswersAfterCompletion: false },
        });
        expect(saved.status).toBe(200);
        const started = await call<AttemptDetail>(
            "post",
            `/quizzes/${quiz.id}/attempts`,
            "learner",
        );
        const path = `/attempts/${started.body.id}/questions/${started.body.questions[0].id}/answer`;
        const premature = await call<ErrorBody>(
            "post",
            `/attempts/${started.body.id}/complete`,
            "learner",
        );
        expect(premature.body.error.code).toBe("REQUIRED_ANSWERS_MISSING");
        const mismatched = await call<ErrorBody>("put", path, "learner", {
            response: { questionType: "multiple_choice_single", optionId: "a" },
        });
        expect(mismatched.status).toBe(400);
        expect(mismatched.body.error.code).toBe("RESPONSE_TYPE_MISMATCH");
        const stillOpen = await call<AttemptDetail>(
            "get",
            `/attempts/${started.body.id}`,
            "learner",
        );
        expect(stillOpen.body.status).toBe("in_progress");
        expect(stillOpen.body.questions[0].userResponse).toBeNull();

        const answered = await call<AttemptDetail>("put", path, "learner", {
            response: { questionType: "exact_text", text: "Paris" },
        });
        expect(answered.status).toBe(200);
        expect(answered.body.questions[0].evaluationResult).toBeNull();
        const duplicate = await call<ErrorBody>("put", path, "learner", {
            response: { questionType: "exact_text", text: "London" },
        });
        expect(duplicate.body.error.code).toBe("QUESTION_ALREADY_ANSWERED");
        const completed = await call<AttemptDetail>(
            "post",
            `/attempts/${started.body.id}/complete`,
            "learner",
        );
        expect(completed.body.scoreSummary).toEqual({ pointsPossible: 2.5, pointsAwarded: 2.5 });
        expect(completed.body.questions[0].correctAnswer).toBeNull();
        expect(completed.body.questions[0].explanation).toBeNull();
        expect(completed.body.questions[0].evaluationResult?.explanation).toBeNull();
        expect(
            (
                await call<ErrorBody>("put", path, "learner", {
                    response: { questionType: "exact_text", text: "Paris" },
                })
            ).body.error.code,
        ).toBe("ATTEMPT_CLOSED");
    });

    it("paginates and filters public resources without leaking private records", async () => {
        const { question, quiz, content } = await fixture();
        const secondQuestion = await call<QuestionDetail>("post", "/questions", "author", {
            content: { ...questionContent, prompt: "Second prompt" },
            visibility: "public",
            status: "published",
        });
        const secondQuiz = await call<QuizDetail>("post", "/quizzes", "author", {
            content: { ...content, title: "Second quiz" },
            visibility: "public",
            status: "published",
        });
        const tag = await call<Tag>("post", "/tags", "author", { name: "Geography" });
        await call("put", `/questions/${question.id}/tags/${tag.body.id}`, "author");
        await call("put", `/quizzes/${quiz.id}/tags/${tag.body.id}`, "author");

        const firstQuestions = await call<Page<QuestionDetail>>("get", "/questions?limit=1");
        const nextQuestions = await call<Page<QuestionDetail>>(
            "get",
            "/questions?limit=1&offset=1",
        );
        expect(firstQuestions.body.nextOffset).toBe(1);
        expect(nextQuestions.body.nextOffset).toBeNull();
        expect(
            new Set([firstQuestions.body.items[0]?.id, nextQuestions.body.items[0]?.id]),
        ).toEqual(new Set([question.id, secondQuestion.body.id]));
        const firstQuizzes = await call<Page<QuizDetail>>("get", "/quizzes?limit=1");
        const nextQuizzes = await call<Page<QuizDetail>>("get", "/quizzes?limit=1&offset=1");
        expect(firstQuizzes.body.nextOffset).toBe(1);
        expect(nextQuizzes.body.nextOffset).toBeNull();
        expect(new Set([firstQuizzes.body.items[0]?.id, nextQuizzes.body.items[0]?.id])).toEqual(
            new Set([quiz.id, secondQuiz.body.id]),
        );
        expect(
            (await call<Page<QuestionDetail>>("get", "/questions?tag=geography")).body.items.map(
                (item) => item.id,
            ),
        ).toEqual([question.id]);
        expect(
            (await call<Page<QuizDetail>>("get", "/quizzes?tag=geography")).body.items.map(
                (item) => item.id,
            ),
        ).toEqual([quiz.id]);

        await call("patch", `/questions/${secondQuestion.body.id}`, "author", {
            visibility: "private",
        });
        await call("patch", `/quizzes/${secondQuiz.body.id}`, "author", { visibility: "private" });
        expect(
            (await call<Page<QuestionDetail>>("get", "/questions")).body.items.map(
                (item) => item.id,
            ),
        ).toEqual([question.id]);
        expect(
            (await call<Page<QuizDetail>>("get", "/quizzes")).body.items.map((item) => item.id),
        ).toEqual([quiz.id]);

        await call("post", `/quizzes/${quiz.id}/attempts`, "learner");
        await call("post", `/quizzes/${quiz.id}/attempts`, "learner");
        const attempts = await call<Page<AttemptDetail>>("get", "/attempts?limit=1", "learner");
        expect(attempts.body.items).toHaveLength(1);
        expect(attempts.body.nextOffset).toBe(1);
    });
});
