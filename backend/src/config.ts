import { z } from "zod";

const environmentSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

export type AppConfig = Readonly<{
    nodeEnv: z.infer<typeof environmentSchema>["NODE_ENV"];
    port: number;
}>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
    const result = environmentSchema.safeParse(environment);

    if (!result.success) {
        throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
    }

    return Object.freeze({
        nodeEnv: result.data.NODE_ENV,
        port: result.data.PORT,
    });
}

export const config = loadConfig();
