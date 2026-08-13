import { apiRequest } from "./client";

export type HealthResponse = { status: "ok" };

export function getHealth(): Promise<HealthResponse> {
    return apiRequest<HealthResponse>("/health");
}
