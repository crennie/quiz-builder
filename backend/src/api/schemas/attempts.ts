import { z } from "zod";

export const attemptParamsSchema = z.object({ attemptId: z.uuid() });
export const attemptQuestionParamsSchema = attemptParamsSchema.extend({ questionId: z.uuid() });
export const attemptListQuerySchema = z.object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().nonnegative().default(0),
});
