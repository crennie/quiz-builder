function normalizeBaseUrl(value: string | undefined): string {
    const baseUrl = value?.trim() || "/api";

    if (!baseUrl.startsWith("/") && !URL.canParse(baseUrl)) {
        throw new Error("VITE_API_BASE_URL must be an absolute URL or a root-relative path.");
    }

    return baseUrl.replace(/\/$/, "");
}

export const config = Object.freeze({
    apiBaseUrl: normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL),
});
