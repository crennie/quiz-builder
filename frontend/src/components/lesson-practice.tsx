import { useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
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
    const history = useInfiniteQuery({
        queryKey: ["attempts", session?.user.id, "lesson", lessonId],
        initialPageParam: 0,
        queryFn: ({ pageParam }) => listAttempts(pageParam, lessonId),
        getNextPageParam: (page) => page.nextOffset ?? undefined,
        enabled: !!session,
    });
    const attempts = history.data?.pages.flatMap((page) => page.items) ?? [];
    const previousQuizzes = Array.from(
        new Map(
            attempts
                .filter((attempt) => !quizzes.some((quiz) => quiz.id === attempt.lessonQuizId))
                .map((attempt) => [attempt.lessonQuizId ?? attempt.quizId, attempt]),
        ).values(),
    );
    function renderAttempts(lessonQuizId: string | null | undefined, quizId: string) {
        const matching = attempts.filter((attempt) =>
            lessonQuizId ? attempt.lessonQuizId === lessonQuizId : attempt.quizId === quizId,
        );
        return (
            <details className="lesson-accordion">
                <summary>
                    Your attempts ({matching.length}
                    {history.hasNextPage ? "+" : ""})
                </summary>
                {history.isPending ? <p role="status">Loading attempts…</p> : null}
                {!history.isPending && !history.isError && matching.length === 0 ? (
                    <p>
                        {history.hasNextPage
                            ? "No attempts in the loaded history. Load more lesson attempts below."
                            : "No attempts yet."}
                    </p>
                ) : null}
                <ul className="card-list">
                    {matching.map((attempt) => (
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
                                {attempt.status === "in_progress" ? "Resume" : "View result"}
                                {" · "}
                                {new Date(attempt.startedAt).toLocaleString()}
                                {attempt.scoreSummary
                                    ? ` · ${attempt.scoreSummary.pointsAwarded} / ${attempt.scoreSummary.pointsPossible} points`
                                    : ""}
                            </button>
                        </li>
                    ))}
                </ul>
            </details>
        );
    }
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
                                    <details className="lesson-accordion">
                                        <summary>
                                            {entry.quiz.title}
                                            <span className="muted small">
                                                {" "}
                                                · {entry.quiz.questions.length} questions
                                            </span>
                                        </summary>
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
                                        {session ? renderAttempts(entry.id, entry.quizId) : null}
                                    </details>
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
                            {previousQuizzes.length ? (
                                <>
                                    <h3>Previously used quizzes</h3>
                                    <ul className="card-list">
                                        {previousQuizzes.map((quiz) => (
                                            <li
                                                className="panel"
                                                key={quiz.lessonQuizId ?? quiz.quizId}
                                            >
                                                <details className="lesson-accordion">
                                                    <summary>{quiz.quizTitle}</summary>
                                                    <p>
                                                        This quiz has been removed or replaced in
                                                        the lesson.
                                                    </p>
                                                    {renderAttempts(quiz.lessonQuizId, quiz.quizId)}
                                                </details>
                                            </li>
                                        ))}
                                    </ul>
                                </>
                            ) : null}
                            {history.isError ? (
                                <div role="alert">
                                    <p>{history.error.message}</p>
                                    <button type="button" onClick={() => void history.refetch()}>
                                        Retry loading attempts
                                    </button>
                                </div>
                            ) : null}
                            {history.hasNextPage ? (
                                <button
                                    type="button"
                                    disabled={starting || history.isFetching}
                                    onClick={() => void history.fetchNextPage()}
                                >
                                    {history.isFetchingNextPage
                                        ? "Loading attempts…"
                                        : "Load more lesson attempts"}
                                </button>
                            ) : null}
                        </>
                    )}
                </>
            )}
            {error ? <p role="alert">{error}</p> : null}
        </section>
    );
}
