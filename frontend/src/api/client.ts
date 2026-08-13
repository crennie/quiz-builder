import { config } from "../config";

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

    return (await response.json()) as T;
}
