import { describe, expect, it, vi } from "vitest";
import {
    createWorkflowProvider,
    loadWorkflowProviderConfig,
} from "../../src/agent/workflow-provider.ts";

const config = {
    url: "https://review.example.test/decide",
    token: "test-token",
    name: "test-provider",
    model: "review-v1",
};
const content = {
    prompt: "What is the largest planet?",
    questionType: "exact_text" as const,
    answerConfig: { questionType: "exact_text" as const, acceptedAnswers: ["Jupiter"] },
    gradingConfig: {
        questionType: "exact_text" as const,
        caseSensitive: false,
        trimWhitespace: true,
    },
    explanation: null,
};

describe("agent workflow provider", () => {
    it("loads separate role settings and sends the exact bounded review input", async () => {
        const loaded = loadWorkflowProviderConfig("review", {
            AGENT_REVIEW_PROVIDER_URL: config.url,
            AGENT_REVIEW_PROVIDER_TOKEN: config.token,
            AGENT_REVIEW_PROVIDER_NAME: config.name,
            AGENT_REVIEW_PROVIDER_MODEL: config.model,
        });
        expect(loaded).toEqual(config);
        const request = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify({
                    schemaVersion: 1,
                    decision: "approved",
                    findings: "Correct",
                    providerRunId: "run-1",
                }),
                { status: 200 },
            ),
        );
        const result = await createWorkflowProvider(config, request)(
            "review",
            content,
            "Prior finding",
        );
        expect(result).toMatchObject({
            role: "review",
            decision: "approved",
            metadata: { providerRunId: "run-1" },
        });
        const body = JSON.parse(request.mock.calls[0][1]!.body as string) as unknown;
        expect(body).toMatchObject({ task: "REVIEW_QUESTION", content, findings: "Prior finding" });
    });

    it("rejects a gate response with a review-only decision", async () => {
        const request = vi.fn<typeof fetch>().mockResolvedValue(
            new Response(
                JSON.stringify({
                    schemaVersion: 1,
                    decision: "approved",
                    findings: "",
                }),
                { status: 200 },
            ),
        );
        await expect(
            createWorkflowProvider(config, request)("gate", content, ""),
        ).rejects.toThrow();
    });
});
