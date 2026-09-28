import type { AuthenticatedUser } from "../auth/supabase.ts";

import { pool } from "./index.ts";

export type Profile = Readonly<{
    id: string;
    displayName: string;
    avatarUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
}>;

type ProfileRow = {
    id: string;
    display_name: string;
    avatar_url: string | null;
    created_at: Date;
    updated_at: Date;
};

function initialDisplayName(metadata: Record<string, unknown>): string {
    for (const field of ["display_name", "full_name", "name"] as const) {
        const value = metadata[field];
        if (typeof value === "string" && value.trim().length > 0) {
            return value.trim().slice(0, 100);
        }
    }

    return "User";
}

function initialAvatarUrl(metadata: Record<string, unknown>): string | null {
    const value = metadata.avatar_url;
    if (typeof value !== "string" || value.length > 2048) return null;

    try {
        const url = new URL(value);
        return url.protocol === "https:" || url.protocol === "http:" ? value : null;
    } catch {
        return null;
    }
}

export async function getOrCreateProfile(user: AuthenticatedUser): Promise<Profile> {
    await pool.query(
        `INSERT INTO public.profiles (id, display_name, avatar_url)
         VALUES ($1, $2, $3)
         ON CONFLICT (id) DO NOTHING`,
        [user.id, initialDisplayName(user.userMetadata), initialAvatarUrl(user.userMetadata)],
    );

    const result = await pool.query<ProfileRow>(
        `SELECT id, display_name, avatar_url, created_at, updated_at
         FROM public.profiles
         WHERE id = $1`,
        [user.id],
    );
    const row = result.rows[0];

    if (!row) throw new Error("Profile was not available after insertion");

    return {
        id: row.id,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
