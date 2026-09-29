import { ApiError, apiRequest, authenticatedRequest } from "./client";

vi.mock("../auth/client", () => ({
    supabase: {
        auth: {
            getSession: vi.fn().mockResolvedValue({
                data: { session: { access_token: "test-token" } },
                error: null,
            }),
        },
    },
}));

describe("apiRequest", () => {
    it("returns JSON for a successful response", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({ status: "ok" }), {
                status: 200,
                headers: { "Content-Type": "application/json" },
            }),
        );

        await expect(apiRequest("/health")).resolves.toEqual({ status: "ok" });
    });

    it("maps the standard API error envelope", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValue(
            new Response(JSON.stringify({ error: { code: "NOT_FOUND", message: "Missing" } }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            }),
        );

        await expect(apiRequest("/missing")).rejects.toEqual(
            new ApiError("Missing", 404, "NOT_FOUND"),
        );
    });

    it("sends the current access token and accepts empty success responses", async () => {
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValue(new Response(null, { status: 204 }));
        await expect(
            authenticatedRequest("/v1/questions/id/tags/id", { method: "DELETE" }),
        ).resolves.toBeUndefined();
        expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/v1/questions/id/tags/id");
        expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
            Authorization: "Bearer test-token",
        });
    });
});
