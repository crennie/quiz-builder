import { z } from "zod";

export const feedbackParamsSchema = z.strictObject({ feedbackId: z.uuid() });
export const feedbackListQuerySchema = z.strictObject({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    offset: z.coerce.number().int().nonnegative().default(0),
});
