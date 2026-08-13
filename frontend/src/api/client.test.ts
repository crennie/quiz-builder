import { ApiError, apiRequest } from "./client";

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
});
