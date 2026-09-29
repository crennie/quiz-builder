import { z } from "zod";

export const quizParamsSchema = z.object({ quizId: z.uuid() });
export const quizTagParamsSchema = quizParamsSchema.extend({ tagId: z.uuid() });
export const quizListQuerySchema = z.object({
    tag: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().nonnegative().default(0),
});
