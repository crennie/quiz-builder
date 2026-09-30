import { QueryClientProvider } from "@tanstack/react-query";
import {
    Outlet,
    RouterProvider,
    createMemoryHistory,
    createRootRoute,
    createRoute,
    createRouter,
} from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { AppLayout } from "../app/layout";
import { createQueryClient } from "../app/query-client";
import { SignInPage } from "../pages/sign-in-page";
import { AuthProvider } from "./auth-context";
import { AuthContext } from "./auth-state";
import { RequireAuth } from "./require-auth";

const mockAuth = vi.hoisted(() => ({
    getSession: vi.fn(),
    onAuthStateChange: vi.fn(),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
}));

vi.mock("./client", () => ({
    supabase: { auth: mockAuth },
}));

const session = { user: { id: "123e4567-e89b-42d3-a456-426614174030" } } as Session;

function renderSignIn() {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const root = createRootRoute({ component: Outlet });
    const signIn = createRoute({
        getParentRoute: () => root,
        path: "/sign-in",
        component: SignInPage,
    });
    const questions = createRoute({
        getParentRoute: () => root,
        path: "/questions",
        component: () => <h1>Question bank</h1>,
    });
    const testRouter = createRouter({
        routeTree: root.addChildren([signIn, questions]),
        history: createMemoryHistory({ initialEntries: ["/sign-in"] }),
    });
    return render(
        <AuthContext.Provider value={{ session: null, loading: false, configured: true }}>
            <RouterProvider router={testRouter} />
        </AuthContext.Provider>,
    );
}

beforeEach(() => {
    vi.resetAllMocks();
    mockAuth.onAuthStateChange.mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockAuth.signOut.mockResolvedValue({ error: null });
});

it("signs up and shows the confirmation state without a session", async () => {
    const user = userEvent.setup();
    mockAuth.signUp.mockResolvedValue({ data: { session: null }, error: null });
    renderSignIn();
    await user.click(await screen.findByRole("button", { name: "New here? Create an account" }));
    await user.type(await screen.findByRole("textbox", { name: "Email" }), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Create account" }));
    expect(mockAuth.signUp).toHaveBeenCalledWith({
        email: "person@example.com",
        password: "secret123",
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("Check your email");
});

it("signs in and navigates to the question bank", async () => {
    const user = userEvent.setup();
    mockAuth.signInWithPassword.mockResolvedValue({ data: { session }, error: null });
    renderSignIn();
    await user.type(await screen.findByRole("textbox", { name: "Email" }), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
        email: "person@example.com",
        password: "secret123",
    });
    expect(await screen.findByRole("heading", { name: "Question bank" })).toBeInTheDocument();
});

it("shows a sign-in failure beside the form", async () => {
    const user = userEvent.setup();
    mockAuth.signInWithPassword.mockResolvedValue({
        data: { session: null },
        error: { message: "Invalid login credentials" },
    });
    renderSignIn();
    await user.type(await screen.findByRole("textbox", { name: "Email" }), "person@example.com");
    await user.type(screen.getByLabelText("Password"), "secret123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid login credentials");
});

it("restores a session and shows protected content after loading", async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session }, error: null });
    render(
        <AuthProvider>
            <RequireAuth>
                <p>Protected content</p>
            </RequireAuth>
        </AuthProvider>,
    );
    expect(await screen.findByText("Protected content")).toBeInTheDocument();
    expect(mockAuth.getSession).toHaveBeenCalledOnce();
});

it("prompts signed-out users and shows configuration guidance", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const root = createRootRoute({ component: Outlet });
    const protectedRoute = createRoute({
        getParentRoute: () => root,
        path: "/",
        component: () => (
            <RequireAuth>
                <p>Protected content</p>
            </RequireAuth>
        ),
    });
    const testRouter = createRouter({
        routeTree: root.addChildren([protectedRoute]),
        history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    const view = render(
        <AuthContext.Provider value={{ session: null, loading: false, configured: true }}>
            <RouterProvider router={testRouter} />
        </AuthContext.Provider>,
    );
    expect(await screen.findByRole("heading", { name: "Sign in to continue" })).toBeInTheDocument();
    view.rerender(
        <AuthContext.Provider value={{ session: null, loading: false, configured: false }}>
            <RouterProvider router={testRouter} />
        </AuthContext.Provider>,
    );
    expect(screen.getByRole("heading", { name: "Set up sign in" })).toBeInTheDocument();
});

it("signs out and clears cached server data", async () => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const user = userEvent.setup();
    const queryClient = createQueryClient();
    queryClient.setQueryData(["private", session.user.id], { value: "cached" });
    const root = createRootRoute({ component: AppLayout });
    const home = createRoute({
        getParentRoute: () => root,
        path: "/",
        component: () => <p>Home</p>,
    });
    const testRouter = createRouter({
        routeTree: root.addChildren([home]),
        history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    render(
        <QueryClientProvider client={queryClient}>
            <AuthContext.Provider value={{ session, loading: false, configured: true }}>
                <RouterProvider router={testRouter} />
            </AuthContext.Provider>
        </QueryClientProvider>,
    );
    await screen.findByRole("navigation", { name: "Primary navigation" });
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Questions" })).toHaveAttribute("href", "/questions");
    expect(screen.getByRole("link", { name: "Quizzes" })).toHaveAttribute("href", "/quizzes");
    expect(screen.getByRole("link", { name: "Attempts" })).toHaveAttribute("href", "/attempts");
    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    await waitFor(() =>
        expect(queryClient.getQueryData(["private", session.user.id])).toBeUndefined(),
    );
    expect(mockAuth.signOut).toHaveBeenCalledOnce();
});
