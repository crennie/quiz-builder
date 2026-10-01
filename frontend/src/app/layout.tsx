import { Link, Outlet } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { useAuth } from "../auth/auth-state";
import { supabase } from "../auth/client";

export function AppLayout() {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    return (
        <div className="app-shell">
            <header className="site-header">
                <Link className="brand" to="/">
                    Quiz Builder
                </Link>
                <nav aria-label="Primary navigation">
                    <Link to="/">Home</Link>
                    <Link to="/questions">Questions</Link>
                    <Link to="/quizzes">Quizzes</Link>
                    <Link to="/attempts">Attempts</Link>
                    {session ? <Link to="/work-items">Work queue</Link> : null}
                    {session ? (
                        <button
                            className="text-button"
                            type="button"
                            onClick={() => {
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
