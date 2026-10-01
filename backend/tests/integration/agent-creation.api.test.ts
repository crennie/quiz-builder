import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
import { verifyAccessToken } from "../../src/auth/supabase.ts";
import { enqueueAgentQuestion } from "../../src/agent/creation.ts";
import { getOrCreateProfile } from "../../src/db/profiles.ts";

vi.mock("../../src/auth/supabase.ts", () => ({ verifyAccessToken: vi.fn() }));
vi.mock("../../src/db/profiles.ts", () => ({ getOrCreateProfile: vi.fn() }));
vi.mock("../../src/agent/creation.ts", () => ({ enqueueAgentQuestion: vi.fn() }));

import { app } from "../../src/app.ts";

const userId = "00000000-0000-4000-8000-000000000401";
const requestKey = "00000000-0000-4000-8000-000000000402";
const itemId = "00000000-0000-4000-8000-000000000403";
const brief = "Create a question about planets";
const item = {
    id: itemId,
    queueName: "question-creation",
    itemType: "CREATE_QUESTION",
    questionId: null,
    questionVersionId: null,
    versionNumber: null,
    prompt: null,
    input: { schemaVersion: 1, type: "CREATE_QUESTION", brief },
    status: "pending",
    attempts: 0,
    claimGeneration: 0,
    claimToken: null,
    assignedAgentActorId: "00000000-0000-4000-8000-00000000a001",
    leaseUntil: null,
    createdAt: "2026-09-30T00:00:00.000Z",
} as const;

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

it("requires a verified sponsor and rejects client-selected actor identity", async () => {
    const anonymous = await request(app)
        .post("/api/v1/agent-questions")
        .send({ brief, requestKey });
    expect(anonymous.status).toBe(401);
    expect(enqueueAgentQuestion).not.toHaveBeenCalled();

    const spoofed = await request(app)
        .post("/api/v1/agent-questions")
        .set("Authorization", "Bearer verified-token")
        .send({ brief, requestKey, agentActorId: itemId });
    expect(spoofed.status).toBe(400);
    expect(enqueueAgentQuestion).not.toHaveBeenCalled();

    vi.mocked(enqueueAgentQuestion).mockResolvedValue(item);
    const accepted = await request(app)
        .post("/api/v1/agent-questions")
        .set("Authorization", "Bearer verified-token")
        .send({ brief, requestKey });
    expect(accepted.status).toBe(202);
    expect(accepted.body).toEqual(item);
    expect(enqueueAgentQuestion).toHaveBeenCalledWith(userId, { brief, requestKey });
});
