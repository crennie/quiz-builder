import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";

import { supabase } from "../auth/client";
import { useAuth } from "../auth/auth-state";

export function SignInPage() {
    const navigate = useNavigate();
    const { session, configured } = useAuth();
    const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!supabase) return;
        setBusy(true);
        setMessage("");
        const result =
            mode === "sign-in"
                ? await supabase.auth.signInWithPassword({ email, password })
                : await supabase.auth.signUp({ email, password });
        setBusy(false);
        if (result.error) {
            setMessage(result.error.message);
            return;
        }
        if (result.data.session) {
            void navigate({ to: "/questions" });
            return;
        }
        setMessage("Check your email to confirm your account, then sign in.");
    }

    if (session)
        return (
            <section className="message-panel">
                <h1>You're signed in</h1>
                <p>Open your question bank to continue.</p>
                <Link className="button" to="/questions">
                    Question bank
                </Link>
            </section>
        );
    return (
        <section className="auth-card">
            <p className="eyebrow">Your question bank</p>
            <h1>{mode === "sign-in" ? "Welcome back" : "Create an account"}</h1>
            <p className="muted">Save questions and build a practice library you can return to.</p>
            {!configured ? (
                <p role="alert">
                    Supabase Auth is not configured. Set the frontend environment variables first.
                </p>
            ) : null}
            <form
                onSubmit={(event) => {
                    void submit(event);
                }}
            >
                <label>
                    Email
                    <input
                        type="email"
                        autoComplete="email"
                        required
                        value={email}
                        onChange={(event) => setEmail(event.target.value)}
                    />
                </label>
                <label>
                    Password
                    <input
                        type="password"
                        minLength={6}
                        autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                        required
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                    />
                </label>
                {message ? <p role="alert">{message}</p> : null}
                <button type="submit" disabled={!configured || busy}>
                    {busy ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
                </button>
            </form>
            <button
                className="text-button"
                type="button"
                onClick={() => {
                    setMode(mode === "sign-in" ? "sign-up" : "sign-in");
                    setMessage("");
                }}
            >
                {mode === "sign-in" ? "New here? Create an account" : "Have an account? Sign in"}
            </button>
        </section>
    );
}
