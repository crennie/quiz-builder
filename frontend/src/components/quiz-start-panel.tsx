import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { QuizDetail } from "@quiz-builder/contracts";

import { listAttempts, startAttempt } from "../api/attempts";
import { useAuth } from "../auth/auth-state";

export function QuizStartPanel({ quiz }: { quiz: QuizDetail }) {
    const { session } = useAuth();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [error, setError] = useState("");
    const recent = useQuery({
        queryKey: ["attempts", session?.user.id, 0],
        queryFn: () => listAttempts(0),
    });
    const start = useMutation({ mutationFn: () => startAttempt(quiz.id) });
    const recentForQuiz = recent.data?.items.filter((attempt) => attempt.quizId === quiz.id) ?? [];

    async function begin() {
        setError("");
        try {
            const attempt = await start.mutateAsync();
            queryClient.setQueryData(["attempt", session?.user.id, attempt.id], attempt);
            void queryClient.invalidateQueries({ queryKey: ["attempts", session?.user.id] });
            await navigate({ to: "/attempts/$attemptId", params: { attemptId: attempt.id } });
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not start quiz.");
        }
    }

    return (
        <section className="panel">
            <h2>Take this quiz</h2>
            <p className="muted">
                {quiz.currentVersion.questions.length} questions ·{" "}
                {quiz.currentVersion.settings.shuffleQuestions
                    ? "Questions shuffled"
                    : "Questions in author order"}{" "}
                ·{" "}
                {quiz.currentVersion.settings.showAnswersAfterCompletion
                    ? "Answers shown after completion"
                    : "Answers hidden in the review"}
            </p>
            {quiz.status === "published" ? (
                <button type="button" disabled={start.isPending} onClick={() => void begin()}>
                    {start.isPending ? "Starting…" : "Start new attempt"}
                </button>
            ) : (
                <p className="muted">
                    This quiz is not published, so new attempts are unavailable.
                </p>
            )}
            {error ? (
                <p role="alert" className="error-text">
                    {error}
                </p>
            ) : null}
            {recent.isPending ? <p className="muted small">Loading recent attempts…</p> : null}
            {recent.isError ? (
                <p role="alert" className="error-text">
                    Could not load recent attempts. {recent.error.message}
                </p>
            ) : null}
            {recentForQuiz.length ? (
                <div className="recent-attempts">
                    <h3>Your recent attempts</h3>
                    <ul>
                        {recentForQuiz.map((attempt) => (
                            <li key={attempt.id}>
                                <Link to="/attempts/$attemptId" params={{ attemptId: attempt.id }}>
                                    {attempt.status === "in_progress"
                                        ? "Resume"
                                        : attempt.status === "completed"
                                          ? "View result"
                                          : "View attempt"}{" "}
                                    · {new Date(attempt.startedAt).toLocaleString()}
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
            <p className="muted small">
                <Link to="/attempts">View all attempt history</Link>
            </p>
        </section>
    );
}
