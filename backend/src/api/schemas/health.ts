import { z } from "zod";

export const healthResponseSchema = z
    .object({
        status: z.literal("ok"),
    })
    .meta({
        id: "HealthResponse",
        description: "The service health status.",
    });

export type HealthResponse = z.output<typeof healthResponseSchema>;
