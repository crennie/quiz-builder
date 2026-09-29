import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { render, screen } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";

import { router } from "./router";
import { createQueryClient } from "./query-client";

it("renders the not-found page through the application router", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});

    const testRouter = createRouter({
        routeTree: router.routeTree,
        history: createMemoryHistory({ initialEntries: ["/missing"] }),
    });

    render(
        <QueryClientProvider client={createQueryClient()}>
            <RouterProvider router={testRouter} />
        </QueryClientProvider>,
    );

    expect(await screen.findByRole("heading", { name: "Page not found" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Return home" })).toHaveAttribute("href", "/");
});
