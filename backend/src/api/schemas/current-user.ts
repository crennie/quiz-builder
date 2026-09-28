import { z } from "zod";

export const currentUserResponseSchema = z
    .object({
        id: z.uuid(),
        displayName: z.string().min(1),
        avatarUrl: z.url().nullable(),
        createdAt: z.iso.datetime({ offset: true }),
        updatedAt: z.iso.datetime({ offset: true }),
    })
    .meta({
        id: "CurrentUserResponse",
        description: "The authenticated user's application profile.",
    });

export type CurrentUserResponse = z.output<typeof currentUserResponseSchema>;
