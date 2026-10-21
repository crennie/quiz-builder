import { z } from "zod";

export const quizParamsSchema = z.object({ quizId: z.uuid() });
export const quizTagParamsSchema = quizParamsSchema.extend({ tagId: z.uuid() });
export const quizListQuerySchema = z.object({
    archived: z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true"),
    tag: z.string().trim().min(1).optional(),
    scope: z.enum(["all", "mine"]).default("all"),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().nonnegative().default(0),
});

export const quizArchiveBodySchema = z.strictObject({ archived: z.boolean() });
