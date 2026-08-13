import { z } from "zod";

export const errorResponseSchema = z
    .object({
        error: z.object({
            code: z.string().min(1),
            message: z.string().min(1),
        }),
    })
    .meta({
        id: "ErrorResponse",
        description: "The standard error envelope returned by the API.",
    });

export type ErrorResponse = z.output<typeof errorResponseSchema>;
