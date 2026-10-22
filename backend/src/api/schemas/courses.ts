import { z } from "zod";
export const courseParamsSchema = z.strictObject({ courseId: z.uuid() });
export const lessonParamsSchema = z.strictObject({ lessonId: z.uuid() });
export const contentListQuerySchema = z.strictObject({
    limit: z.coerce.number().int().min(1).max(100).default(50),
    offset: z.coerce.number().int().nonnegative().default(0),
});

export const courseListQuerySchema = contentListQuerySchema.extend({
    archived: z
        .enum(["true", "false"])
        .default("false")
        .transform((value) => value === "true"),
});
export const courseArchiveBodySchema = z.strictObject({ archived: z.boolean() });
