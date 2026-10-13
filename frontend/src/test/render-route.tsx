import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { render } from "@testing-library/react";
import { router } from "../app/router";
import { createQueryClient } from "../app/query-client";
import { AuthContext } from "../auth/auth-state";
import { owner } from "./domain-fixtures";
export function renderAt(path: string) {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const testRouter = createRouter({
        routeTree: router.routeTree,
        history: createMemoryHistory({ initialEntries: [path] }),
    });
    const client = createQueryClient();
    return {
        ...render(
            <QueryClientProvider client={client}>
                <AuthContext.Provider
                    value={{
                        session: { user: { id: owner } } as Session,
                        loading: false,
                        configured: true,
                    }}
                >
                    <RouterProvider router={testRouter} />
                </AuthContext.Provider>
            </QueryClientProvider>,
        ),
        client,
        testRouter,
    };
}
