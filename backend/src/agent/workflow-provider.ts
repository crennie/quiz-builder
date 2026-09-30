import { questionVersionContentSchema, type QuestionVersionContent } from "@quiz-builder/contracts";
import { z } from "zod";
import { agentGenerationMetadataSchema } from "./provider.ts";

export type AgentRole = "review" | "revision" | "gate";
const configSchema = z.object({
    url: z.url().refine((value) => {
        const url = new URL(value);
        return (
            url.protocol === "https:" ||
            (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))
        );
    }),
    token: z.string().min(1),
    name: z.string().trim().min(1).max(100),
    model: z.string().trim().min(1).max(100),
});
export type WorkflowProviderConfig = z.output<typeof configSchema>;

export function loadWorkflowProviderConfig(
    role: AgentRole,
    environment: NodeJS.ProcessEnv = process.env,
) {
    const prefix = `AGENT_${role.toUpperCase()}_PROVIDER_`;
    return configSchema.parse({
        url: environment[`${prefix}URL`],
        token: environment[`${prefix}TOKEN`],
        name: environment[`${prefix}NAME`],
        model: environment[`${prefix}MODEL`],
    });
}

const reviewResponse = z.strictObject({
    schemaVersion: z.literal(1),
    decision: z.enum(["approved", "changes_requested", "rejected"]),
    findings: z.string().trim().max(5000),
    providerRunId: z.string().max(200).optional(),
});
const gateResponse = z.strictObject({
    schemaVersion: z.literal(1),
    decision: z.enum(["approve_and_publish", "changes_requested", "rejected"]),
    findings: z.string().trim().max(5000),
    providerRunId: z.string().max(200).optional(),
});
const revisionResponse = z.strictObject({
    schemaVersion: z.literal(1),
    content: questionVersionContentSchema,
    providerRunId: z.string().max(200).optional(),
});
export type WorkflowOutput =
    | {
          role: "review";
          decision: z.output<typeof reviewResponse>["decision"];
          findings: string;
          metadata: z.output<typeof agentGenerationMetadataSchema>;
      }
    | {
          role: "gate";
          decision: z.output<typeof gateResponse>["decision"];
          findings: string;
          metadata: z.output<typeof agentGenerationMetadataSchema>;
      }
    | {
          role: "revision";
          content: QuestionVersionContent;
          metadata: z.output<typeof agentGenerationMetadataSchema>;
      };

export function createWorkflowProvider(
    config: WorkflowProviderConfig,
    request: typeof fetch = fetch,
) {
    return async (
        role: AgentRole,
        content: QuestionVersionContent,
        findings: string,
    ): Promise<WorkflowOutput> => {
        const started = Date.now();
        const body = JSON.stringify({
            schemaVersion: 1,
            task:
                role === "review"
                    ? "REVIEW_QUESTION"
                    : role === "revision"
                      ? "REVISE_QUESTION"
                      : "APPROVE_PUBLICATION",
            content,
            findings,
            model: config.model,
        });
        if (Buffer.byteLength(body) > 65_536)
            throw new Error("Agent provider request exceeds 64 KiB");
        const response = await request(config.url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.token}`,
            },
            body,
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
            if (!(next.value instanceof Uint8Array))
                throw new Error("Invalid provider response bytes");
            bytes += next.value.byteLength;
            if (bytes > 65_536) {
                await reader.cancel();
                throw new Error("Agent provider response exceeds 64 KiB");
            }
            chunks.push(next.value);
        }
        const raw: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        const parsed =
            role === "review"
                ? reviewResponse.parse(raw)
                : role === "gate"
                  ? gateResponse.parse(raw)
                  : revisionResponse.parse(raw);
        const metadata = agentGenerationMetadataSchema.parse({
            latencyMs: Date.now() - started,
            ...(parsed.providerRunId ? { providerRunId: parsed.providerRunId } : {}),
        });
        if (role === "revision")
            return {
                role,
                content: (parsed as z.output<typeof revisionResponse>).content,
                metadata,
            };
        if (role === "review") {
            const decision = reviewResponse.parse(parsed);
            return { role, decision: decision.decision, findings: decision.findings, metadata };
        }
        const decision = gateResponse.parse(parsed);
        return { role, decision: decision.decision, findings: decision.findings, metadata };
    };
}
