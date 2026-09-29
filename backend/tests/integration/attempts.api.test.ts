import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { verifyAccessToken } from "../../src/auth/supabase.ts";
import { getOrCreateProfile } from "../../src/db/profiles.ts";
import {
    completeAttempt,
    getAttempt,
    listAttempts,
    startAttempt,
    submitAnswer,
} from "../../src/db/attempts.ts";

vi.mock("../../src/auth/supabase.ts", () => ({ verifyAccessToken: vi.fn() }));
vi.mock("../../src/db/profiles.ts", () => ({ getOrCreateProfile: vi.fn() }));
vi.mock("../../src/db/attempts.ts", () => ({
    completeAttempt: vi.fn(),
    getAttempt: vi.fn(),
    listAttempts: vi.fn(),
    startAttempt: vi.fn(),
    submitAnswer: vi.fn(),
}));

import { app } from "../../src/app.ts";

const userId = "123e4567-e89b-42d3-a456-426614174001";
const quizId = "223e4567-e89b-42d3-a456-426614174001";
const versionId = "323e4567-e89b-42d3-a456-426614174001";
const attemptId = "423e4567-e89b-42d3-a456-426614174001";
const questionId = "523e4567-e89b-42d3-a456-426614174001";
const timestamp = "2026-09-28T00:00:00.000Z";
const attempt = {
    id: attemptId,
    quizId,
    quizVersionId: versionId,
    quizTitle: "Quiz",
    status: "in_progress" as const,
    startedAt: timestamp,
    completedAt: null,
    settings: { shuffleQuestions: false, showAnswersAfterCompletion: true },
    scoreSummary: null,
    questions: [
        {
            id: questionId,
            position: 0,
            prompt: "Question",
            questionType: "exact_text" as const,
            options: null,
            required: true,
            timeLimitSeconds: null,
            pointsPossible: 2.5,
            userResponse: null,
            pointsAwarded: null,
            evaluationResult: null,
            correctAnswer: null,
            explanation: null,
            answeredAt: null,
        },
    ],
};

describe("attempt API", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(verifyAccessToken).mockResolvedValue({ id: userId, userMetadata: {} });
        vi.mocked(getOrCreateProfile).mockResolvedValue({
            id: userId,
            displayName: "User",
            avatarUrl: null,
            createdAt: new Date(timestamp),
            updatedAt: new Date(timestamp),
        });
    });

    it("requires a verified user and validates submitted answers", async () => {
        expect((await request(app).post(`/api/v1/quizzes/${quizId}/attempts`)).status).toBe(401);
        const invalid = await request(app)
            .put(`/api/v1/attempts/${attemptId}/questions/${questionId}/answer`)
            .set("Authorization", "Bearer verified-token")
            .send({ response: { questionType: "multiple_choice_multi", optionIds: ["a", "a"] } });
        expect(invalid.status).toBe(400);
        expect(submitAnswer).not.toHaveBeenCalled();
    });

    it("routes start, load, answer, complete, and history", async () => {
        const auth = { Authorization: "Bearer verified-token" };
        vi.mocked(startAttempt).mockResolvedValueOnce(attempt);
        const started = await request(app).post(`/api/v1/quizzes/${quizId}/attempts`).set(auth);
        expect(started.status).toBe(201);
        expect(startAttempt).toHaveBeenCalledWith(quizId, userId);
        vi.mocked(getAttempt).mockResolvedValueOnce(attempt);
        expect((await request(app).get(`/api/v1/attempts/${attemptId}`).set(auth)).status).toBe(
            200,
        );
        const response = { questionType: "exact_text" as const, text: "answer" };
        vi.mocked(submitAnswer).mockResolvedValueOnce(attempt);
        expect(
            (
                await request(app)
                    .put(`/api/v1/attempts/${attemptId}/questions/${questionId}/answer`)
                    .set(auth)
                    .send({ response })
            ).status,
        ).toBe(200);
        expect(submitAnswer).toHaveBeenCalledWith(attemptId, questionId, userId, response);
        vi.mocked(completeAttempt).mockResolvedValueOnce(attempt);
        expect(
            (await request(app).post(`/api/v1/attempts/${attemptId}/complete`).set(auth)).status,
        ).toBe(200);
        vi.mocked(listAttempts).mockResolvedValueOnce({ items: [attempt], nextOffset: null });
        const history = await request(app).get("/api/v1/attempts").set(auth);
        expect(history.status).toBe(200);
        expect(history.body).toMatchObject({ items: [{ id: attemptId }] });
        expect(listAttempts).toHaveBeenCalledWith(userId, { limit: 20, offset: 0 });
    });
});
