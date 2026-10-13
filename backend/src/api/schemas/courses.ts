import { z } from "zod";
export const courseParamsSchema = z.strictObject({ courseId: z.uuid() });
export const lessonParamsSchema = z.strictObject({ lessonId: z.uuid() });
export const contentListQuerySchema = z.strictObject({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().nonnegative().default(0),
});
