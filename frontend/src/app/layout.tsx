import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/auth-state";
import { supabase } from "../auth/client";
import { ThemeToggle } from "./theme-toggle";

export function AppLayout() {
    const { session } = useAuth();
    const quizWorkspace = useRouterState({
        select: (state) => /^\/quizzes(?:\/|$)/u.test(state.location.pathname),
    });
    const pathname = useRouterState({ select: (state) => state.location.pathname });
    const queryClient = useQueryClient();
    return (
        <div className={`app-shell${quizWorkspace ? " quiz-workspace" : ""}`}>
            <header className="site-header">
                <Link className="brand" to="/">
                    <img src="/brand/quiz-builder.png" alt="" width="48" height="48" />
                    <span className="brand-wordmark">
                        Quiz <span>Builder</span>
                    </span>
                </Link>
                <nav aria-label="Primary navigation">
                    <Link to="/">Home</Link>
                    <Link to="/quizzes">My Quizzes</Link>
                    <Link to="/courses">Courses</Link>
                    <ThemeToggle />
                    {session ? (
                        <button
                            className="text-button"
                            type="button"
                            onClick={() => {
                                const attemptId = /^\/attempts\/([^/]+)$/u.exec(pathname)?.[1];
                                const attempt = attemptId
                                    ? queryClient.getQueryData<{ status: string }>([
                                          "attempt",
                                          session?.user.id,
                                          attemptId,
                                      ])
                                    : undefined;
                                if (
                                    attempt?.status === "in_progress" &&
                                    !window.confirm(
                                        "Sign out and leave this quiz? Submitted answers are saved, but any unsubmitted answer will be lost.",
                                    )
                                )
                                    return;
                                void supabase?.auth.signOut().then(() => queryClient.clear());
                            }}
                        >
                            Sign out
                        </button>
                    ) : (
                        <Link to="/sign-in">Sign in</Link>
                    )}
                </nav>
            </header>
            <main className="page-content">
                <Outlet />
            </main>
        </div>
    );
}
