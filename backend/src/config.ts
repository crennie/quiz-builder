import { z } from "zod";

const environmentSchema = z.object({
    DATABASE_URL: z
        .url()
        .refine((url) => ["postgres:", "postgresql:"].includes(new URL(url).protocol), {
            message: "DATABASE_URL must use the postgres or postgresql protocol",
        }),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

export type AppConfig = Readonly<{
    databaseUrl: string;
    nodeEnv: z.infer<typeof environmentSchema>["NODE_ENV"];
    port: number;
}>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
    const result = environmentSchema.safeParse(environment);

    if (!result.success) {
        throw new Error(`Invalid environment configuration:\n${z.prettifyError(result.error)}`);
    }

    return Object.freeze({
        databaseUrl: result.data.DATABASE_URL,
        nodeEnv: result.data.NODE_ENV,
        port: result.data.PORT,
    });
}

export const config = loadConfig();
