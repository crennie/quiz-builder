import request from "supertest";
import { questionBatchArtifactSchema } from "@quiz-builder/contracts";
import { beforeEach, expect, it, vi } from "vitest";
import { verifyAccessToken } from "../../src/auth/supabase.ts";
import { getOrCreateProfile } from "../../src/db/profiles.ts";
import {
    getQuestionBatch,
    ingestQuestionBatch,
    materializeQuestionBatch,
} from "../../src/db/question-batches.ts";

vi.mock("../../src/auth/supabase.ts", () => ({ verifyAccessToken: vi.fn() }));
vi.mock("../../src/db/profiles.ts", () => ({ getOrCreateProfile: vi.fn() }));
vi.mock("../../src/db/question-batches.ts", () => ({
    getQuestionBatch: vi.fn(),
    ingestQuestionBatch: vi.fn(),
    listQuestionBatches: vi.fn(),
    materializeQuestionBatch: vi.fn(),
}));

import { app } from "../../src/app.ts";

const userId = "00000000-0000-4000-8000-000000000811";
const batchId = "00000000-0000-4000-8000-000000000812";
const artifact = questionBatchArtifactSchema.parse({
    schemaVersion: 1,
    batchKey: "00000000-0000-4000-8000-000000000813",
    topic: "REST endpoints",
    source: { kind: "external_agent", label: "Offline agent" },
    tags: ["REST APIs"],
    questions: [
        {
            key: "rest-01",
            content: {
                prompt: "Which method retrieves a resource?",
                questionType: "exact_text",
                answerConfig: { questionType: "exact_text", acceptedAnswers: ["GET"] },
                gradingConfig: {
                    questionType: "exact_text",
                    caseSensitive: false,
                    trimWhitespace: true,
                },
                explanation: "GET retrieves a representation.",
            },
        },
    ],
});
const batch = {
    id: batchId,
    artifact,
    artifactSha256: "a".repeat(64),
    createdAt: "2026-10-01T00:00:00.000Z",
    items: [],
};

beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(verifyAccessToken).mockResolvedValue({ id: userId, userMetadata: {} });
    vi.mocked(getOrCreateProfile).mockResolvedValue({
        id: userId,
        displayName: "Tester",
        avatarUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
    });
});

it("requires an authenticated uploader and validates the full batch before ingest", async () => {
    const anonymous = await request(app).post("/api/v1/question-batches").send(artifact);
    expect(anonymous.status).toBe(401);
    const invalid = await request(app)
        .post("/api/v1/question-batches")
        .set("Authorization", "Bearer verified-token")
        .send({ ...artifact, questions: [artifact.questions[0], artifact.questions[0]] });
    expect(invalid.status).toBe(400);
    const invalidTag = await request(app)
        .post("/api/v1/question-batches")
        .set("Authorization", "Bearer verified-token")
        .send({ ...artifact, tags: ["!!!"] });
    expect(invalidTag.status).toBe(400);
    const spoofed = await request(app)
        .post("/api/v1/question-batches")
        .set("Authorization", "Bearer verified-token")
        .send({ ...artifact, sponsorId: userId });
    expect(spoofed.status).toBe(400);
    expect(ingestQuestionBatch).not.toHaveBeenCalled();
    vi.mocked(ingestQuestionBatch).mockResolvedValue(batch);
    const accepted = await request(app)
        .post("/api/v1/question-batches")
        .set("Authorization", "Bearer verified-token")
        .send(artifact);
    expect(accepted.status).toBe(201);
    expect(ingestQuestionBatch).toHaveBeenCalledWith(userId, artifact);
});

it("passes the authenticated sponsor to reads and materialization", async () => {
    vi.mocked(getQuestionBatch).mockResolvedValue(batch);
    vi.mocked(materializeQuestionBatch).mockResolvedValue(batch);
    const read = await request(app)
        .get(`/api/v1/question-batches/${batchId}`)
        .set("Authorization", "Bearer verified-token");
    expect(read.status).toBe(200);
    expect(getQuestionBatch).toHaveBeenCalledWith(batchId, userId);
    const materialized = await request(app)
        .post(`/api/v1/question-batches/${batchId}/materialize`)
        .set("Authorization", "Bearer verified-token")
        .send({});
    expect(materialized.status).toBe(200);
    expect(materializeQuestionBatch).toHaveBeenCalledWith(batchId, userId);
});

it("rejects an oversized batch request with a bounded error", async () => {
    const oversized = await request(app)
        .post("/api/v1/question-batches")
        .set("Authorization", "Bearer verified-token")
        .send({ ...artifact, topic: "x".repeat(270_000) });
    expect(oversized.status).toBe(413);
    expect(oversized.body).toMatchObject({ error: { code: "PAYLOAD_TOO_LARGE" } });
    expect(ingestQuestionBatch).not.toHaveBeenCalled();
});
