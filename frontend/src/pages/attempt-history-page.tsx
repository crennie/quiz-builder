import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { listAttempts } from "../api/attempts";
import { useAuth } from "../auth/auth-state";

export function AttemptHistoryPage() {
    const { session } = useAuth();
    const [offset, setOffset] = useState(0);
    const attempts = useQuery({
        queryKey: ["attempts", session?.user.id, offset],
        queryFn: () => listAttempts(offset),
    });

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <p className="eyebrow">Practice</p>
                    <h1>Attempt history</h1>
                    <p className="muted">
                        Resume an unfinished quiz or revisit a completed result.
                    </p>
                </div>
                <Link className="button" to="/quizzes">
                    Browse quizzes
                </Link>
            </div>
            {attempts.isPending ? <p role="status">Loading attempts…</p> : null}
            {attempts.isError ? (
                <div className="message-panel" role="alert">
                    <p>Could not load attempts. {attempts.error.message}</p>
                    <button type="button" onClick={() => void attempts.refetch()}>
                        Try again
                    </button>
                </div>
            ) : null}
            {attempts.data ? (
                <section aria-label="Attempts">
                    {attempts.data.items.length ? (
                        <ul className="card-list">
                            {attempts.data.items.map((attempt) => (
                                <li className="question-card" key={attempt.id}>
                                    <h2>{attempt.quizTitle}</h2>
                                    <p className="muted small">
                                        Started {new Date(attempt.startedAt).toLocaleString()} ·{" "}
                                        {attempt.status.replaceAll("_", " ")}
                                        {attempt.scoreSummary
                                            ? ` · ${attempt.scoreSummary.pointsAwarded} / ${attempt.scoreSummary.pointsPossible} points`
                                            : ""}
                                    </p>
                                    <div className="quiz-actions">
                                        <Link
                                            className="button"
                                            to="/attempts/$attemptId"
                                            params={{ attemptId: attempt.id }}
                                        >
                                            {attempt.status === "in_progress"
                                                ? "Resume"
                                                : attempt.status === "completed"
                                                  ? "View results"
                                                  : "View attempt"}
                                        </Link>
                                        <Link
                                            to="/quizzes/$quizId"
                                            params={{ quizId: attempt.quizId }}
                                        >
                                            Quiz details
                                        </Link>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="message-panel">
                            <p>No attempts yet. Choose a published quiz to begin.</p>
                        </div>
                    )}
                    <div className="pagination">
                        <button
                            type="button"
                            className="secondary"
                            disabled={offset === 0}
                            onClick={() => setOffset(Math.max(0, offset - 20))}
                        >
                            Previous
                        </button>
                        <span>Page {Math.floor(offset / 20) + 1}</span>
                        <button
                            type="button"
                            className="secondary"
                            disabled={attempts.data.nextOffset === null}
                            onClick={() => setOffset(attempts.data.nextOffset ?? offset)}
                        >
                            Next
                        </button>
                    </div>
                </section>
            ) : null}
        </div>
    );
}
