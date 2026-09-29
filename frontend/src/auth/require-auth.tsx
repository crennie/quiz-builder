import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

import { useAuth } from "./auth-state";

export function RequireAuth({ children }: { children: ReactNode }) {
    const auth = useAuth();
    if (!auth.configured)
        return (
            <section className="message-panel">
                <h1>Set up sign in</h1>
                <p>
                    Add the Supabase URL and publishable key to the frontend environment to use Quiz
                    Builder.
                </p>
            </section>
        );
    if (auth.loading) return <p role="status">Checking your session…</p>;
    if (!auth.session)
        return (
            <section className="message-panel">
                <h1>Sign in to continue</h1>
                <p>Your questions, quizzes, and attempts are tied to your account.</p>
                <Link className="button" to="/sign-in">
                    Sign in
                </Link>
            </section>
        );
    return children;
}
