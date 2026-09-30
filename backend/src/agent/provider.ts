import { questionVersionContentSchema, type QuestionVersionContent } from "@quiz-builder/contracts";
import { z } from "zod";

const providerEnvironmentSchema = z.strictObject({
    AGENT_PROVIDER_URL: z.url().refine((value) => {
        const url = new URL(value);
        return (
            url.protocol === "https:" ||
            (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
        );
    }, "Agent provider URL must use HTTPS or loopback HTTP"),
    AGENT_PROVIDER_TOKEN: z.string().min(1),
    AGENT_PROVIDER_NAME: z.string().trim().min(1).max(100),
    AGENT_PROVIDER_MODEL: z.string().trim().min(1).max(100),
});
const responseSchema = z.strictObject({
    schemaVersion: z.literal(1),
    content: questionVersionContentSchema,
    providerRunId: z.string().max(200).optional(),
});
export const agentGenerationMetadataSchema = z.strictObject({
    latencyMs: z.number().int().nonnegative(),
    providerRunId: z.string().max(200).optional(),
});

export type AgentProviderConfig = z.output<typeof providerEnvironmentSchema>;
export type AgentGeneration = {
    content: QuestionVersionContent;
    metadata: z.output<typeof agentGenerationMetadataSchema>;
};
export type AgentProvider = (brief: string) => Promise<AgentGeneration>;

export function loadAgentProviderConfig(
    environment: NodeJS.ProcessEnv = process.env,
): AgentProviderConfig {
    const result = providerEnvironmentSchema.safeParse(environment);
    if (!result.success)
        throw new Error(`Invalid agent provider configuration:\n${z.prettifyError(result.error)}`);
    return result.data;
}

export function createHttpAgentProvider(
    config: AgentProviderConfig,
    request: typeof fetch = fetch,
): AgentProvider {
    return async (brief) => {
        const started = Date.now();
        const response = await request(config.AGENT_PROVIDER_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.AGENT_PROVIDER_TOKEN}`,
            },
            body: JSON.stringify({
                schemaVersion: 1,
                task: "CREATE_QUESTION",
                brief,
                model: config.AGENT_PROVIDER_MODEL,
            }),
            signal: AbortSignal.timeout(90_000),
        });
        if (!response.ok) throw new Error(`Agent provider returned HTTP ${response.status}`);
        if (!response.body) throw new Error("Agent provider returned no response body");
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = [];
        let bytes = 0;
        while (true) {
            const next = await reader.read();
            if (next.done) break;
            const chunk: unknown = next.value;
            if (!(chunk instanceof Uint8Array))
                throw new Error("Agent provider returned invalid bytes");
            bytes += chunk.byteLength;
            if (bytes > 65_536) {
                await reader.cancel();
                throw new Error("Agent provider response exceeds 64 KiB");
            }
            chunks.push(chunk);
        }
        const parsed = responseSchema.parse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
        return {
            content: parsed.content,
            metadata: agentGenerationMetadataSchema.parse({
                latencyMs: Date.now() - started,
                ...(parsed.providerRunId ? { providerRunId: parsed.providerRunId } : {}),
            }),
        };
    };
}
