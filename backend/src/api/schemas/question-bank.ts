import { z } from "zod";

export const questionParamsSchema = z.strictObject({ questionId: z.uuid() });
export const questionTagParamsSchema = z.strictObject({ questionId: z.uuid(), tagId: z.uuid() });
export const questionListQuerySchema = z.strictObject({
    tag: z.string().trim().min(1).max(100).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().nonnegative().default(0),
});
