import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";

import { createQueryClient } from "../app/query-client";
import { HomePage } from "./home-page";

it("shows the application purpose and connected API state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ status: "ok" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        }),
    );

    render(
        <QueryClientProvider client={createQueryClient()}>
            <HomePage />
        </QueryClientProvider>,
    );

    expect(screen.getByRole("heading", { name: /build better questions/i })).toBeInTheDocument();
    expect(await screen.findByText("API connected")).toBeInTheDocument();
});
