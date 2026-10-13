import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { verifyAccessToken } from "../../src/auth/supabase.ts";
import {
    createQuestion,
    getQuestionDetail,
    listManagedQuestions,
} from "../../src/db/question-bank.ts";
import { getOrCreateProfile } from "../../src/db/profiles.ts";

vi.mock("../../src/auth/supabase.ts", () => ({ verifyAccessToken: vi.fn() }));
vi.mock("../../src/db/profiles.ts", () => ({ getOrCreateProfile: vi.fn() }));
vi.mock("../../src/db/question-bank.ts", () => ({
    createQuestion: vi.fn(),
    getQuestionDetail: vi.fn(),
    listManagedQuestions: vi.fn(),
    saveQuestionContent: vi.fn(),
    createTag: vi.fn(),
    listTags: vi.fn(),
    assignQuestionTag: vi.fn(),
    removeQuestionTag: vi.fn(),
}));

import { app } from "../../src/app.ts";

const userId = "123e4567-e89b-42d3-a456-426614174000";
const questionId = "223e4567-e89b-42d3-a456-426614174000";
const timestamp = "2026-09-28T00:00:00.000Z";
const content = {
    prompt: "What is two plus two?",
    questionType: "exact_text" as const,
    answerConfig: { questionType: "exact_text" as const, acceptedAnswers: ["4"] },
    gradingConfig: {
        questionType: "exact_text" as const,
        caseSensitive: false,
        trimWhitespace: true,
    },
    explanation: null,
};
const detail = {
    ...content,
    id: questionId,
    createdBy: userId,
    visibility: "private" as const,
    createdAt: timestamp,
    updatedAt: timestamp,
    tags: [],
    isOwner: true,
    canEditContent: true,
    contentLockedAt: null,
};
const bankDetail = {
    ...detail,
    visibility: "public" as const,
    isOwner: false,
    canEditContent: false,
};

describe("question bank API", () => {
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

    it("returns public direct question content to an anonymous reader", async () => {
        vi.mocked(getQuestionDetail).mockResolvedValueOnce(bankDetail);

        const response = await request(app).get(`/api/v1/questions/${questionId}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(bankDetail);
        expect(getQuestionDetail).toHaveBeenCalledWith(questionId, null);
        expect(verifyAccessToken).not.toHaveBeenCalled();
    });

    it("does not treat an invalid bearer token as an anonymous request", async () => {
        const response = await request(app)
            .get(`/api/v1/questions/${questionId}`)
            .set("Authorization", "Bearer token with spaces");

        expect(response.status).toBe(401);
        expect(getQuestionDetail).not.toHaveBeenCalled();
    });

    it("requires a user access token to create a question", async () => {
        const response = await request(app).post("/api/v1/questions").send({});

        expect(response.status).toBe(401);
        expect(createQuestion).not.toHaveBeenCalled();
    });

    it("creates a private direct question", async () => {
        vi.mocked(createQuestion).mockResolvedValueOnce({
            ...detail,
            isOwner: true,
        });

        const response = await request(app)
            .post("/api/v1/questions")
            .set("Authorization", "Bearer verified-token")
            .send({
                content: {
                    prompt: content.prompt,
                    questionType: content.questionType,
                    answerConfig: content.answerConfig,
                    gradingConfig: content.gradingConfig,
                    explanation: content.explanation,
                },
            });

        expect(response.status).toBe(201);
        expect(createQuestion).toHaveBeenCalledWith(userId, {
            content: {
                prompt: content.prompt,
                questionType: content.questionType,
                answerConfig: content.answerConfig,
                gradingConfig: content.gradingConfig,
                explanation: content.explanation,
            },
        });
    });

    it("rejects mismatched answer and question types before persistence", async () => {
        const response = await request(app)
            .post("/api/v1/questions")
            .set("Authorization", "Bearer verified-token")
            .send({
                content: {
                    prompt: "Prompt",
                    questionType: "exact_text",
                    answerConfig: {
                        questionType: "multiple_choice_single",
                        options: [
                            { id: "a", text: "A" },
                            { id: "b", text: "B" },
                        ],
                        correctOptionId: "a",
                    },
                    gradingConfig: {
                        questionType: "exact_text",
                        caseSensitive: false,
                        trimWhitespace: true,
                    },
                    explanation: null,
                },
            });

        expect(response.status).toBe(400);
        expect(response.body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
        expect(createQuestion).not.toHaveBeenCalled();
    });

    it("rejects publication through the create payload", async () => {
        const response = await request(app)
            .post("/api/v1/questions")
            .set("Authorization", "Bearer verified-token")
            .send({
                content: {
                    prompt: content.prompt,
                    questionType: content.questionType,
                    answerConfig: content.answerConfig,
                    gradingConfig: content.gradingConfig,
                    explanation: content.explanation,
                },
                status: "published",
            });

        expect(response.status).toBe(400);
        expect(createQuestion).not.toHaveBeenCalled();
    });

    it("validates list pagination", async () => {
        const response = await request(app)
            .get("/api/v1/questions/mine?limit=1000")
            .set("Authorization", "Bearer verified-token");

        expect(response.status).toBe(400);
        expect(listManagedQuestions).not.toHaveBeenCalled();
    });
});
