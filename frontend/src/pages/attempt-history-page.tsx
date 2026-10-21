import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { listAttempts } from "../api/attempts";
import { useAuth } from "../auth/auth-state";
import styles from "./attempt-history-page.module.css";

type HistoryAttempt = Awaited<ReturnType<typeof listAttempts>>["items"][number];

function groupByDay(items: HistoryAttempt[]) {
    const groups = new Map<string, { date: Date; items: HistoryAttempt[] }>();
    for (const attempt of [...items].sort(
        (a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt),
    )) {
        const date = new Date(attempt.startedAt);
        const key = date.toDateString();
        const group = groups.get(key) ?? { date, items: [] };
        group.items.push(attempt);
        groups.set(key, group);
    }
    return [...groups.entries()];
}

function dayLabel(date: Date) {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
    });
}

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
                        <div className={styles.history}>
                            {groupByDay(attempts.data.items).map(([day, group]) => (
                                <div key={`${offset}-${day}`}>
                                    <h2 className={styles.dayHeading}>
                                        <span>{dayLabel(group.date)}</span>
                                        <span className={styles.count}>
                                            {group.items.length}{" "}
                                            {group.items.length === 1 ? "attempt" : "attempts"}
                                        </span>
                                    </h2>
                                    <ul className={styles.list}>
                                        {group.items.map((attempt) => (
                                            <li className={styles.row} key={attempt.id}>
                                                <time
                                                    className={styles.time}
                                                    dateTime={attempt.startedAt}
                                                >
                                                    {new Date(attempt.startedAt).toLocaleTimeString(
                                                        undefined,
                                                        {
                                                            hour: "numeric",
                                                            minute: "2-digit",
                                                        },
                                                    )}
                                                </time>
                                                <div className={styles.description}>
                                                    <Link
                                                        className={styles.title}
                                                        to="/quizzes/$quizId"
                                                        params={{ quizId: attempt.quizId }}
                                                    >
                                                        {attempt.quizTitle}
                                                    </Link>
                                                    <div className={styles.metadata}>
                                                        <span>
                                                            {attempt.status.replaceAll("_", " ")}
                                                        </span>
                                                        {attempt.scoreSummary ? (
                                                            <span>
                                                                {attempt.scoreSummary.pointsAwarded}{" "}
                                                                /{" "}
                                                                {
                                                                    attempt.scoreSummary
                                                                        .pointsPossible
                                                                }{" "}
                                                                points
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                </div>
                                                <Link
                                                    className={styles.action}
                                                    to="/attempts/$attemptId"
                                                    params={{ attemptId: attempt.id }}
                                                >
                                                    {attempt.status === "in_progress"
                                                        ? "Resume"
                                                        : attempt.status === "completed"
                                                          ? "View results"
                                                          : "View attempt"}
                                                    <span aria-hidden="true"> →</span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="message-panel">
                            <p>No attempts yet. Choose a quiz to begin.</p>
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
