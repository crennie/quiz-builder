import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/auth-state";
import { supabase } from "../auth/client";
import { ThemeToggle } from "./theme-toggle";
import { ProfileMenu } from "./profile-menu";

export function AppLayout() {
    const { session } = useAuth();
    const quizWorkspace = useRouterState({
        select: (state) => /^\/quizzes(?:\/|$)/u.test(state.location.pathname),
    });
    const pathname = useRouterState({ select: (state) => state.location.pathname });
    const lessonWorkspace = /^\/courses\/[^/]+\/lessons\/[^/]+\/?$/u.test(pathname);
    const queryClient = useQueryClient();
    return (
        <div
            className={`app-shell${quizWorkspace ? " quiz-workspace" : ""}${lessonWorkspace ? " lesson-workspace" : ""}`}
        >
            <header className="site-header">
                <div className="site-header-inner">
                    <Link className={`brand${pathname === "/" ? " brand-home" : ""}`} to="/">
                        <span className="brand-mascot" aria-hidden="true">
                            <img src="/brand/quiz-builder.png" alt="" width="48" height="48" />
                        </span>
                        <span className="brand-wordmark">
                            Quiz <span>Builder</span>
                        </span>
                    </Link>
                    <nav aria-label="Primary navigation">
                        <Link to="/">Home</Link>
                        <Link to="/quizzes">My Quizzes</Link>
                        <Link to="/courses/mine">My Courses</Link>
                        <Link to="/courses">Courses</Link>
                        {session ? (
                            <ProfileMenu
                                key={pathname}
                                onSignOut={() => {
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
                            />
                        ) : (
                            <>
                                <ThemeToggle />
                                <Link to="/sign-in">Sign in</Link>
                            </>
                        )}
                    </nav>
                </div>
            </header>
            <main className="page-content">
                <Outlet />
            </main>
        </div>
    );
}
