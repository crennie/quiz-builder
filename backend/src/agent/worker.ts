import { closeDatabase } from "../db/index.ts";
import { logger } from "../logger.ts";
import { processOneAgentQuestion } from "./creation.ts";
import { createHttpAgentProvider, loadAgentProviderConfig } from "./provider.ts";
import { processOneWorkflowItem } from "./workflow.ts";
import {
    createWorkflowProvider,
    loadWorkflowProviderConfig,
    type AgentRole,
} from "./workflow-provider.ts";

const role = process.env.AGENT_WORKER_ROLE ?? "creation";
if (!["creation", "review", "revision", "gate"].includes(role))
    throw new Error("AGENT_WORKER_ROLE must be creation, review, revision, or gate");
const config =
    role === "creation" ? loadAgentProviderConfig() : loadWorkflowProviderConfig(role as AgentRole);
const provider =
    role === "creation"
        ? createHttpAgentProvider(config as ReturnType<typeof loadAgentProviderConfig>)
        : createWorkflowProvider(config as ReturnType<typeof loadWorkflowProviderConfig>);
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
        stopping = true;
    });
}

try {
    while (!stopping) {
        try {
            const processed =
                role === "creation"
                    ? await processOneAgentQuestion(
                          provider as ReturnType<typeof createHttpAgentProvider>,
                          {
                              name: (config as ReturnType<typeof loadAgentProviderConfig>)
                                  .AGENT_PROVIDER_NAME,
                              model: (config as ReturnType<typeof loadAgentProviderConfig>)
                                  .AGENT_PROVIDER_MODEL,
                          },
                      )
                    : await processOneWorkflowItem(
                          role as AgentRole,
                          provider as ReturnType<typeof createWorkflowProvider>,
                          {
                              name: (config as ReturnType<typeof loadWorkflowProviderConfig>).name,
                              model: (config as ReturnType<typeof loadWorkflowProviderConfig>)
                                  .model,
                          },
                      );
            if (processed) continue;
        } catch (error) {
            logger.error({ err: error }, "Agent worker iteration failed");
        }
        await new Promise((resolve) => setTimeout(resolve, 3000));
    }
} finally {
    await closeDatabase();
}
