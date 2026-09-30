import { describe, expect, it, vi } from "vitest";
import { createHttpAgentProvider, loadAgentProviderConfig } from "../../src/agent/provider.ts";

const config = loadAgentProviderConfig({
    AGENT_PROVIDER_URL: "http://127.0.0.1:9999/generate",
    AGENT_PROVIDER_TOKEN: "local-token",
    AGENT_PROVIDER_NAME: "local-agent",
    AGENT_PROVIDER_MODEL: "test-model",
});
const content = {
    prompt: "What is the largest planet?",
    questionType: "exact_text",
    answerConfig: { questionType: "exact_text", acceptedAnswers: ["Jupiter"] },
    gradingConfig: { questionType: "exact_text", caseSensitive: false, trimWhitespace: true },
    explanation: null,
};

describe("agent provider adapter", () => {
    it("sends a fixed scoped task and validates the generated question", async () => {
        const request = vi
            .fn<typeof fetch>()
            .mockResolvedValue(
                new Response(
                    JSON.stringify({ schemaVersion: 1, content, providerRunId: "run-123" }),
                    { status: 200 },
                ),
            );
        const generated = await createHttpAgentProvider(
            config,
            request,
        )("A question about planets");
        expect(generated.content).toEqual(content);
        expect(generated.metadata.providerRunId).toBe("run-123");
        const [url, options] = request.mock.calls[0];
        expect(url).toBe(config.AGENT_PROVIDER_URL);
        expect(options?.method).toBe("POST");
        expect(options?.headers).toEqual({
            "Content-Type": "application/json",
            Authorization: "Bearer local-token",
        });
        expect(options?.body).toBe(
            JSON.stringify({
                schemaVersion: 1,
                task: "CREATE_QUESTION",
                brief: "A question about planets",
                model: "test-model",
            }),
        );
    });
    it("rejects malformed provider output and insecure remote configuration", async () => {
        const request = vi
            .fn<typeof fetch>()
            .mockResolvedValue(
                new Response(
                    JSON.stringify({ schemaVersion: 1, content: { ...content, prompt: "" } }),
                    { status: 200 },
                ),
            );
        await expect(
            createHttpAgentProvider(config, request)("A question about planets"),
        ).rejects.toThrow();
        expect(() =>
            loadAgentProviderConfig({
                ...config,
                AGENT_PROVIDER_URL: "http://example.com/generate",
            }),
        ).toThrow("HTTPS");
        const oversized = vi
            .fn<typeof fetch>()
            .mockResolvedValue(new Response("x".repeat(65_537), { status: 200 }));
        await expect(
            createHttpAgentProvider(config, oversized)("A question about planets"),
        ).rejects.toThrow("64 KiB");
    });
});
