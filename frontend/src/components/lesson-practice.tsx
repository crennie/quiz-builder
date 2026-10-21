import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { LessonQuiz } from "@quiz-builder/contracts";
import { listAttempts, startAttempt } from "../api/attempts";
import { useAuth } from "../auth/auth-state";
import { AttemptPlayer } from "../pages/attempt-page";

export function LessonPractice({
    lessonId,
    quizzes,
    onPlaying,
}: {
    lessonId: string;
    quizzes: LessonQuiz[];
    onPlaying: (value: boolean) => void;
}) {
    const { session } = useAuth();
    const client = useQueryClient();
    const [attemptId, setAttemptId] = useState<string | null>(null);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState("");
    const [offset, setOffset] = useState(0);
    const history = useQuery({
        queryKey: ["attempts", session?.user.id, "lesson", lessonId, offset],
        queryFn: () => listAttempts(offset, lessonId),
        enabled: !!session,
    });
    async function start(quiz: LessonQuiz) {
        setStarting(true);
        onPlaying(true);
        setError("");
        try {
            const attempt = await startAttempt(quiz.quizId, quiz.id);
            client.setQueryData(["attempt", session?.user.id, attempt.id], attempt);
            setAttemptId(attempt.id);
            void client.invalidateQueries({ queryKey: ["attempts", session?.user.id] });
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not start quiz.");
            onPlaying(false);
        } finally {
            setStarting(false);
        }
    }
    function close() {
        setAttemptId(null);
        onPlaying(false);
    }
    return (
        <section className="page-stack" aria-label="Lesson quizzes">
            <h2>Practice quizzes</h2>
            {attemptId ? (
                <AttemptPlayer key={attemptId} attemptId={attemptId} onClose={close} />
            ) : (
                <>
                    {quizzes.length ? (
                        <ul className="card-list">
                            {quizzes.map((entry) => (
                                <li className="panel" key={entry.id}>
                                    <h3>{entry.quiz.title}</h3>
                                    {entry.quiz.description ? (
                                        <p>{entry.quiz.description}</p>
                                    ) : null}
                                    <p>{entry.quiz.questions.length} questions</p>
                                    <button
                                        type="button"
                                        disabled={!session || starting}
                                        onClick={() => void start(entry)}
                                    >
                                        {starting ? "Starting…" : "Start / retry quiz"}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>No quizzes have been added to this lesson yet.</p>
                    )}
                    {!session ? (
                        <p>Sign in to take quizzes and view your previous attempts.</p>
                    ) : (
                        <>
                            <h3>Your lesson attempts</h3>
                            {history.isPending ? <p role="status">Loading attempts…</p> : null}
                            {history.isError ? <p role="alert">{history.error.message}</p> : null}
                            {history.data?.items.length === 0 ? <p>No attempts yet.</p> : null}
                            <ul className="card-list">
                                {history.data?.items.map((attempt) => (
                                    <li key={attempt.id}>
                                        <button
                                            type="button"
                                            className="secondary"
                                            disabled={starting}
                                            onClick={() => {
                                                setAttemptId(attempt.id);
                                                onPlaying(true);
                                            }}
                                        >
                                            {attempt.quizTitle} ·{" "}
                                            {attempt.status === "in_progress"
                                                ? "Resume"
                                                : "View result"}{" "}
                                            · {new Date(attempt.startedAt).toLocaleString()}
                                            {attempt.scoreSummary
                                                ? ` · ${attempt.scoreSummary.pointsAwarded} / ${attempt.scoreSummary.pointsPossible} points`
                                                : ""}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <div className="pagination">
                                <button
                                    type="button"
                                    disabled={starting || offset === 0}
                                    onClick={() => setOffset(Math.max(0, offset - 20))}
                                >
                                    Previous attempts
                                </button>
                                <button
                                    type="button"
                                    disabled={starting || history.data?.nextOffset == null}
                                    onClick={() => setOffset(history.data?.nextOffset ?? offset)}
                                >
                                    More attempts
                                </button>
                            </div>
                        </>
                    )}
                </>
            )}
            {error ? <p role="alert">{error}</p> : null}
        </section>
    );
}
