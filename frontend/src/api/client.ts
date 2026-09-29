import { config } from "../config";
import { supabase } from "../auth/client";

type ErrorEnvelope = {
    error?: {
        code?: unknown;
        message?: unknown;
    };
};

export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
        readonly code = "HTTP_ERROR",
    ) {
        super(message);
        this.name = "ApiError";
    }
}

export async function apiRequest<T>(path: `/${string}`, init?: RequestInit): Promise<T> {
    const response = await fetch(`${config.apiBaseUrl}${path}`, {
        ...init,
        headers: { Accept: "application/json", ...init?.headers },
    });

    if (!response.ok) {
        const body = (await response.json().catch(() => null)) as ErrorEnvelope | null;
        const message = body?.error?.message;
        const code = body?.error?.code;

        throw new ApiError(
            typeof message === "string"
                ? message
                : `Request failed with status ${response.status}.`,
            response.status,
            typeof code === "string" ? code : undefined,
        );
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
}

export async function authenticatedRequest<T>(path: `/${string}`, init?: RequestInit): Promise<T> {
    if (!supabase) throw new Error("Supabase Auth is not configured.");
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) throw new ApiError("Sign in to continue.", 401, "UNAUTHORIZED");
    return apiRequest<T>(path, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...init?.headers,
            Authorization: `Bearer ${data.session.access_token}`,
        },
    });
}
