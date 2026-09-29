import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { verifyAccessToken } from "../../src/auth/supabase.ts";
import {
    createFeedback,
    listReceivedFeedback,
    updateFeedbackStatus,
} from "../../src/db/feedback.ts";
import { getOrCreateProfile } from "../../src/db/profiles.ts";

vi.mock("../../src/auth/supabase.ts", () => ({ verifyAccessToken: vi.fn() }));
vi.mock("../../src/db/profiles.ts", () => ({ getOrCreateProfile: vi.fn() }));
vi.mock("../../src/db/feedback.ts", () => ({
    createFeedback: vi.fn(),
    listReceivedFeedback: vi.fn(),
    updateFeedbackStatus: vi.fn(),
}));

import { app } from "../../src/app.ts";

const userId = "123e4567-e89b-42d3-a456-426614174020";
const questionId = "223e4567-e89b-42d3-a456-426614174020";
const quizId = "323e4567-e89b-42d3-a456-426614174020";
const feedbackId = "423e4567-e89b-42d3-a456-426614174020";
const timestamp = "2026-09-28T00:00:00.000Z";
const feedback = {
    id: feedbackId,
    submittedBy: userId,
    questionId,
    quizId: null,
    quizAttemptQuestionId: null,
    category: "typo" as const,
    comment: "Typo",
    status: "open" as const,
    createdAt: timestamp,
    reviewedAt: null,
};
const auth = { Authorization: "Bearer verified-token" };

describe("feedback API", () => {
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

    it("requires authentication and exactly one target", async () => {
        expect((await request(app).post("/api/v1/feedback").send({})).status).toBe(401);
        for (const body of [
            { category: "other", comment: "Missing target" },
            { questionId, quizId, category: "other", comment: "Two targets" },
        ]) {
            const response = await request(app).post("/api/v1/feedback").set(auth).send(body);
            expect(response.status).toBe(400);
        }
        expect(createFeedback).not.toHaveBeenCalled();
    });

    it("routes submission, received list, and status review", async () => {
        vi.mocked(createFeedback).mockResolvedValueOnce(feedback);
        const submitted = await request(app)
            .post("/api/v1/feedback")
            .set(auth)
            .send({ questionId, category: "typo", comment: "Typo" });
        expect(submitted.status).toBe(201);
        expect(createFeedback).toHaveBeenCalledWith(userId, {
            questionId,
            category: "typo",
            comment: "Typo",
        });
        vi.mocked(listReceivedFeedback).mockResolvedValueOnce({
            items: [feedback],
            nextOffset: null,
        });
        const received = await request(app).get("/api/v1/feedback/received").set(auth);
        expect(received.status).toBe(200);
        expect(received.body).toMatchObject({ items: [{ id: feedbackId }] });
        expect(listReceivedFeedback).toHaveBeenCalledWith(userId, { limit: 20, offset: 0 });
        vi.mocked(updateFeedbackStatus).mockResolvedValueOnce({
            ...feedback,
            status: "reviewed",
            reviewedAt: timestamp,
        });
        const reviewed = await request(app)
            .patch(`/api/v1/feedback/${feedbackId}`)
            .set(auth)
            .send({ status: "reviewed" });
        expect(reviewed.status).toBe(200);
        expect(updateFeedbackStatus).toHaveBeenCalledWith(feedbackId, userId, "reviewed");
    });
});
