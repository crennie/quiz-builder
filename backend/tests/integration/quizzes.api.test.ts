import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { verifyAccessToken } from "../../src/auth/supabase.ts";
import { getOrCreateProfile } from "../../src/db/profiles.ts";
import { createQuiz, getQuizDetail, saveQuizContent } from "../../src/db/quizzes.ts";

vi.mock("../../src/auth/supabase.ts", () => ({ verifyAccessToken: vi.fn() }));
vi.mock("../../src/db/profiles.ts", () => ({ getOrCreateProfile: vi.fn() }));
vi.mock("../../src/db/quizzes.ts", () => ({
    assignQuizTag: vi.fn(),
    createQuiz: vi.fn(),
    getQuizDetail: vi.fn(),
    getQuizVersions: vi.fn(),
    listQuizzes: vi.fn(),
    removeQuizTag: vi.fn(),
    saveQuizContent: vi.fn(),
    updateQuizMetadata: vi.fn(),
}));

import { app } from "../../src/app.ts";

const userId = "123e4567-e89b-42d3-a456-426614174000";
const quizId = "223e4567-e89b-42d3-a456-426614174000";
const versionId = "323e4567-e89b-42d3-a456-426614174000";
const timestamp = "2026-09-28T00:00:00.000Z";
const content = {
    title: "Study",
    description: null,
    settings: { shuffleQuestions: false, showAnswersAfterCompletion: true },
    questions: [],
};
const detail = {
    id: quizId,
    createdBy: userId,
    visibility: "public" as const,
    status: "published" as const,
    createdAt: timestamp,
    updatedAt: timestamp,
    tags: [],
    isOwner: false,
    currentVersion: {
        id: versionId,
        versionNumber: 1,
        ...content,
        createdBy: userId,
        createdAt: timestamp,
    },
};

describe("quiz API", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(verifyAccessToken).mockResolvedValue({ id: userId, userMetadata: {} });
        vi.mocked(getOrCreateProfile).mockResolvedValue({
            id: userId,
            displayName: "Test User",
            avatarUrl: null,
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
        });
    });

    it("returns an accessible quiz to an anonymous reader", async () => {
        vi.mocked(getQuizDetail).mockResolvedValueOnce(detail);
        const response = await request(app).get(`/api/v1/quizzes/${quizId}`);
        expect(response.status).toBe(200);
        expect(response.body).toEqual(detail);
        expect(getQuizDetail).toHaveBeenCalledWith(quizId, null);
    });

    it("requires authentication for creation and validates quiz content", async () => {
        expect((await request(app).post("/api/v1/quizzes").send({})).status).toBe(401);
        const response = await request(app)
            .post("/api/v1/quizzes")
            .set("Authorization", "Bearer verified-token")
            .send({ content: { ...content, questions: [{ questionId: quizId }] } });
        expect(response.status).toBe(400);
        expect(createQuiz).not.toHaveBeenCalled();
    });

    it("creates a private draft by default and sends a no-op save to the backend", async () => {
        const owned = {
            ...detail,
            visibility: "private" as const,
            status: "draft" as const,
            isOwner: true,
        };
        vi.mocked(createQuiz).mockResolvedValueOnce(owned);
        const created = await request(app)
            .post("/api/v1/quizzes")
            .set("Authorization", "Bearer verified-token")
            .send({ content });
        expect(created.status).toBe(201);
        expect(createQuiz).toHaveBeenCalledWith(userId, {
            content,
            visibility: "private",
            status: "draft",
        });
        vi.mocked(saveQuizContent).mockResolvedValueOnce(owned);
        const saved = await request(app)
            .put(`/api/v1/quizzes/${quizId}/content`)
            .set("Authorization", "Bearer verified-token")
            .send(content);
        expect(saved.status).toBe(200);
        expect(saved.body).toMatchObject({ currentVersion: { id: versionId } });
        expect(saveQuizContent).toHaveBeenCalledWith(quizId, userId, content);
    });
});
