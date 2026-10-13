import { applyMigrations } from "./apply-migrations.ts";
import { PGlite } from "@electric-sql/pglite";
import type {
    AttemptDetail,
    Feedback,
    QuestionDetail,
    QuizDetail,
    Tag,
} from "@quiz-builder/contracts";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../../src/errors/app-error.ts";
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
    const q = await call<QuestionDetail>("post", "/questions", "author", {
        content: questionContent,
    });
    expect(q.status).toBe(201);
    const content = {
        title: "Geography practice",
        description: null,
        settings,
        questions: [{ questionId: q.body.id, points: 2.5, required: true, timeLimitSeconds: 30 }],
    };
    const quiz = await call<QuizDetail>("post", "/quizzes", "author", { content });
    expect(quiz.status).toBe(201);
    return { question: q.body, quiz: quiz.body, content };
}
describe("HTTP and database core workflows", () => {
    beforeEach(async () => {
        const database = new PGlite();
        databaseState.current = database;
        await database.exec("CREATE SCHEMA auth;CREATE TABLE auth.users(id uuid PRIMARY KEY)");
        await applyMigrations((sql) => database.exec(sql));
        for (const id of Object.values(users))
            await database.query("INSERT INTO auth.users(id) VALUES($1)", [id]);
        vi.resetAllMocks();
        vi.mocked(verifyAccessToken).mockImplementation((token) => {
            const id = users[token as keyof typeof users];
            if (!id) throw new AppError(401, "UNAUTHORIZED", "Invalid token");
            return Promise.resolve({ id, userMetadata: { display_name: token } });
        });
    });
    afterEach(async () => {
        await databaseState.current?.close();
        databaseState.current = null;
    });
    it("runs private authoring, practice, history, and feedback through HTTP and SQL", async () => {
        const { question, quiz, content } = await fixture();
        const start = await call<AttemptDetail>("post", `/quizzes/${quiz.id}/attempts`, "author");
        expect(start.status).toBe(201);
        const a = start.body;
        expect((await call("post", `/quizzes/${quiz.id}/attempts`, "learner")).status).toBe(404);
        expect((await call("get", `/attempts/${a.id}`, "learner")).status).toBe(404);
        expect(
            (
                await call("put", `/questions/${question.id}/content`, "author", {
                    ...questionContent,
                    prompt: "Changed",
                })
            ).status,
        ).toBe(409);
        expect(
            (
                await call("put", `/quizzes/${quiz.id}/content`, "author", {
                    ...content,
                    title: "Changed",
                })
            ).status,
        ).toBe(409);
        expect((await call("put", `/quizzes/${quiz.id}/content`, "author", content)).status).toBe(
            200,
        );
        expect(
            (
                await call(
                    "put",
                    `/attempts/${a.id}/questions/${a.questions[0].id}/answer`,
                    "author",
                    { response: { questionType: "exact_text", text: " paris " } },
                )
            ).status,
        ).toBe(200);
        const end = await call<AttemptDetail>("post", `/attempts/${a.id}/complete`, "author");
        expect(end.body.scoreSummary).toEqual({ pointsPossible: 2.5, pointsAwarded: 2.5 });
        expect(end.body.questions[0].correctAnswer).toEqual(questionContent.answerConfig);
        const feedback = await call<Feedback>("post", "/feedback", "author", {
            quizAttemptQuestionId: a.questions[0].id,
            category: "typo",
            comment: "Check wording",
        });
        expect(feedback.status).toBe(201);
        expect(
            (await call<Page<Feedback>>("get", "/feedback/received", "author")).body.items,
        ).toContainEqual(feedback.body);
        expect(
            (
                await call("patch", `/feedback/${feedback.body.id}`, "learner", {
                    status: "resolved",
                })
            ).status,
        ).toBe(404);
        expect(
            (await call("patch", `/feedback/${feedback.body.id}`, "author", { status: "resolved" }))
                .status,
        ).toBe(200);
        expect(
            (await call<Page<AttemptDetail>>("get", "/attempts", "author")).body.items,
        ).toContainEqual(end.body);
    });
    it("rejects public creation, legacy fields, promotion, and all removed endpoints", async () => {
        for (const extra of [
            { visibility: "public" },
            { visibility: "private" },
            { status: "draft" },
            { currentVersion: {} },
        ]) {
            expect(
                (await call("post", "/questions", "author", { content: questionContent, ...extra }))
                    .status,
            ).toBe(400);
            expect(
                (
                    await call("post", "/quizzes", "author", {
                        content: { title: "Quiz", description: null, settings, questions: [] },
                        ...extra,
                    })
                ).status,
            ).toBe(400);
        }
        const { question, quiz } = await fixture();
        const removed: [Method, string][] = [
            ["get", "/questions"],
            ["post", "/agent-questions"],
            ["get", "/work-items"],
            ["patch", `/questions/${question.id}`],
            ["patch", `/quizzes/${quiz.id}`],
        ];
        for (const tail of ["manage", "versions", "published-versions"])
            removed.push(["get", `/questions/${question.id}/${tail}`]);
        for (const tail of [
            "publish",
            "unpublish",
            "archive",
            "restore",
            "versions",
            "review-submissions",
        ])
            removed.push(["post", `/questions/${question.id}/${tail}`]);
        for (const tail of ["versions"]) removed.push(["get", `/quizzes/${quiz.id}/${tail}`]);
        for (const tail of ["publish", "archive"])
            removed.push(["post", `/quizzes/${quiz.id}/${tail}`]);
        for (const tail of ["claim", "decision", "fail", "hand-off", "cancel"])
            removed.push(["post", `/work-items/${quiz.id}/${tail}`]);
        for (const [method, path] of removed)
            expect(await call<ErrorBody>(method, path, "author", {})).toMatchObject({
                status: 404,
                body: { error: { code: "NOT_FOUND" } },
            });
    });
    it("supports owner and public reads, personal pagination, tags, and invalid-token rejection", async () => {
        const { question, quiz } = await fixture();
        expect((await call("get", `/questions/${question.id}`, "learner")).status).toBe(404);
        expect((await call("get", `/questions/${question.id}`)).status).toBe(404);
        expect((await call("get", "/questions/mine")).status).toBe(401);
        const tag = await call<Tag>("post", "/tags", "author", { name: "Geography" });
        expect(tag.status).toBe(201);
        expect(
            (await call("put", `/questions/${question.id}/tags/${tag.body.id}`, "author")).status,
        ).toBe(200);
        expect(
            (await call("put", `/quizzes/${quiz.id}/tags/${tag.body.id}`, "author")).status,
        ).toBe(200);
        expect(
            (
                await call<Page<QuestionDetail>>(
                    "get",
                    `/questions/mine?tag=geography&limit=1`,
                    "author",
                )
            ).body.items[0].id,
        ).toBe(question.id);
        await databaseState.current!.query(
            "UPDATE public.questions SET visibility='public' WHERE id=$1",
            [question.id],
        );
        await databaseState.current!.query(
            "UPDATE public.quizzes SET visibility='public' WHERE id=$1",
            [quiz.id],
        );
        expect((await call<QuestionDetail>("get", `/questions/${question.id}`)).body).toMatchObject(
            { isOwner: false, visibility: "public" },
        );
        expect((await call("get", `/quizzes/${quiz.id}`)).status).toBe(200);
        expect((await call("post", `/quizzes/${quiz.id}/attempts`, "learner")).status).toBe(201);
        const invalid = await request(app)
            .get(`/api/v1/quizzes/${quiz.id}`)
            .set("Authorization", "Bearer invalid");
        expect(invalid.status).toBe(401);
    });
    it("serves ordered public course reads and exposes no hierarchy mutations", async () => {
        const db = databaseState.current!;
        const course = await db.query<{ id: string }>(
            "INSERT INTO public.courses(title) VALUES('Course') RETURNING id",
        );
        const id = course.rows[0].id;
        const lessons = await db.query<{ id: string }>(
            "INSERT INTO public.lessons(course_id,title,position) VALUES($1,'Second',1),($1,'First',0) RETURNING id",
            [id],
        );
        expect(
            (await call<Page<{ title: string }>>("get", `/courses/${id}/lessons`)).body.items.map(
                (l) => l.title,
            ),
        ).toEqual(["First", "Second"]);
        expect((await call("get", `/lessons/${lessons.rows[0].id}`)).status).toBe(200);
        expect((await call("get", `/lessons/${lessons.rows[0].id}/quizzes`)).status).toBe(200);
        expect((await call("get", "/courses?limit=1")).status).toBe(200);
        expect((await call("get", `/courses/${id}`)).status).toBe(200);
        expect((await call("post", "/courses", "author", { title: "Write" })).status).toBe(404);
    });
});
