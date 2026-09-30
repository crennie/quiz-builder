import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { verifyAccessToken } from "../../src/auth/supabase.ts";
import {
    createQuestion,
    getBankQuestionDetail,
    listQuestions,
} from "../../src/db/question-bank.ts";
import { getOrCreateProfile } from "../../src/db/profiles.ts";

vi.mock("../../src/auth/supabase.ts", () => ({ verifyAccessToken: vi.fn() }));
vi.mock("../../src/db/profiles.ts", () => ({ getOrCreateProfile: vi.fn() }));
vi.mock("../../src/db/question-bank.ts", () => ({
    assignQuestionTag: vi.fn(),
    createQuestion: vi.fn(),
    createQuestionVersion: vi.fn(),
    createTag: vi.fn(),
    getBankQuestionDetail: vi.fn(),
    getQuestionDetail: vi.fn(),
    getQuestionVersions: vi.fn(),
    getPublishedQuestionVersions: vi.fn(),
    listQuestions: vi.fn(),
    listManagedQuestions: vi.fn(),
    listTags: vi.fn(),
    publishQuestion: vi.fn(),
    unpublishQuestion: vi.fn(),
    archiveQuestion: vi.fn(),
    restoreQuestion: vi.fn(),
    removeQuestionTag: vi.fn(),
    updateQuestionMetadata: vi.fn(),
}));

import { app } from "../../src/app.ts";

const userId = "123e4567-e89b-42d3-a456-426614174000";
const questionId = "223e4567-e89b-42d3-a456-426614174000";
const versionId = "323e4567-e89b-42d3-a456-426614174000";
const timestamp = "2026-09-28T00:00:00.000Z";
const detail = {
    id: questionId,
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
        prompt: "What is two plus two?",
        questionType: "exact_text" as const,
        answerConfig: { questionType: "exact_text" as const, acceptedAnswers: ["4"] },
        gradingConfig: {
            questionType: "exact_text" as const,
            caseSensitive: false,
            trimWhitespace: true,
        },
        explanation: "Two and two make four.",
        createdBy: userId,
        createdAt: timestamp,
    },
};
const { currentVersion: publishedVersion, ...identity } = detail;
const bankDetail = { ...identity, publishedVersion };

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

    it("returns full published question content to an anonymous reader", async () => {
        vi.mocked(getBankQuestionDetail).mockResolvedValueOnce(bankDetail);

        const response = await request(app).get(`/api/v1/questions/${questionId}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual(bankDetail);
        expect(getBankQuestionDetail).toHaveBeenCalledWith(questionId, null);
        expect(verifyAccessToken).not.toHaveBeenCalled();
    });

    it("does not treat an invalid bearer token as an anonymous request", async () => {
        const response = await request(app)
            .get(`/api/v1/questions/${questionId}`)
            .set("Authorization", "Bearer token with spaces");

        expect(response.status).toBe(401);
        expect(getBankQuestionDetail).not.toHaveBeenCalled();
    });

    it("requires a user access token to create a question", async () => {
        const response = await request(app).post("/api/v1/questions").send({});

        expect(response.status).toBe(401);
        expect(createQuestion).not.toHaveBeenCalled();
    });

    it("creates a question with private draft defaults", async () => {
        vi.mocked(createQuestion).mockResolvedValueOnce({
            ...detail,
            visibility: "private",
            status: "draft",
            isOwner: true,
        });

        const response = await request(app)
            .post("/api/v1/questions")
            .set("Authorization", "Bearer verified-token")
            .send({
                content: {
                    prompt: detail.currentVersion.prompt,
                    questionType: detail.currentVersion.questionType,
                    answerConfig: detail.currentVersion.answerConfig,
                    gradingConfig: detail.currentVersion.gradingConfig,
                    explanation: detail.currentVersion.explanation,
                },
            });

        expect(response.status).toBe(201);
        expect(createQuestion).toHaveBeenCalledWith(userId, {
            content: {
                prompt: detail.currentVersion.prompt,
                questionType: detail.currentVersion.questionType,
                answerConfig: detail.currentVersion.answerConfig,
                gradingConfig: detail.currentVersion.gradingConfig,
                explanation: detail.currentVersion.explanation,
            },
            visibility: "private",
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
                    prompt: detail.currentVersion.prompt,
                    questionType: detail.currentVersion.questionType,
                    answerConfig: detail.currentVersion.answerConfig,
                    gradingConfig: detail.currentVersion.gradingConfig,
                    explanation: detail.currentVersion.explanation,
                },
                status: "published",
            });

        expect(response.status).toBe(400);
        expect(createQuestion).not.toHaveBeenCalled();
    });

    it("validates list pagination", async () => {
        const response = await request(app).get("/api/v1/questions?limit=1000");

        expect(response.status).toBe(400);
        expect(listQuestions).not.toHaveBeenCalled();
    });
});
