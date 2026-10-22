import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { AttemptDetail, LessonQuiz } from "@quiz-builder/contracts";
import { listLessonAttempts, startAttempt } from "../api/attempts";
import { useAuth } from "../auth/auth-state";
import { AttemptPlayer } from "../pages/attempt-page";

export function LessonPractice({
    archived = false,
    enrolled,
    lessonId,
    quizzes,
    onPlaying,
}: {
    archived?: boolean;
    enrolled: boolean;
    lessonId: string;
    quizzes: LessonQuiz[];
    onPlaying: (value: boolean) => void;
}) {
    const { session } = useAuth();
    const client = useQueryClient();
    const [attemptId, setAttemptId] = useState<string | null>(null);
    const [starting, setStarting] = useState(false);
    const [error, setError] = useState("");
    const history = useQuery({
        queryKey: ["attempts", session?.user.id, "lesson", lessonId, "all"],
        queryFn: () => listLessonAttempts(lessonId),
        enabled: !!session,
    });
    const attempts = history.data ?? [];
    const previousQuizzes = Array.from(
        new Map(
            attempts
                .filter((attempt) => !quizzes.some((quiz) => quiz.id === attempt.lessonQuizId))
                .map((attempt) => [attempt.lessonQuizId ?? attempt.quizId, attempt]),
        ).values(),
    );
    function quizAttempts(lessonQuizId: string | null | undefined, quizId: string) {
        return attempts.filter((attempt) =>
            lessonQuizId ? attempt.lessonQuizId === lessonQuizId : attempt.quizId === quizId,
        );
    }
    function renderProgress(lessonQuizId: string | null | undefined, quizId: string) {
        if (!session) return null;
        if (history.isPending) return <span className="muted small"> · Loading progress…</span>;
        if (history.isError) return <span className="muted small"> · Progress unavailable</span>;
        const matching = quizAttempts(lessonQuizId, quizId);
        const completed = matching.filter((attempt) => attempt.status === "completed");
        const best = completed.reduce<AttemptDetail["scoreSummary"]>((best, attempt) => {
            const score = attempt.scoreSummary;
            if (!score) return best;
            if (!best) return score;
            const ratio = (value: NonNullable<typeof score>) =>
                value.pointsPossible > 0 ? value.pointsAwarded / value.pointsPossible : 0;
            return ratio(score) > ratio(best) ? score : best;
        }, null);
        return (
            <span className="muted small">
                {" · "}
                {matching.length} {matching.length === 1 ? "attempt" : "attempts"}
                {completed.length ? (
                    <span className="lesson-quiz-completed">
                        {" "}
                        · <span aria-hidden="true">✓</span> Completed
                    </span>
                ) : (
                    " · Not completed"
                )}
                {best ? ` · Best: ${best.pointsAwarded} / ${best.pointsPossible} points` : ""}
            </span>
        );
    }
    function renderAttempts(lessonQuizId: string | null | undefined, quizId: string) {
        const matching = quizAttempts(lessonQuizId, quizId);
        return (
            <details className="lesson-accordion">
                <summary>Your attempts ({matching.length})</summary>
                {history.isPending ? <p role="status">Loading attempts…</p> : null}
                {!history.isPending && !history.isError && matching.length === 0 ? (
                    <p>No attempts yet.</p>
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
            {session && !enrolled ? <p>Enroll in this course to take quizzes.</p> : null}
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
                                            {renderProgress(entry.id, entry.quizId)}
                                        </summary>
                                        {entry.quiz.description ? (
                                            <p>{entry.quiz.description}</p>
                                        ) : null}
                                        <p>{entry.quiz.questions.length} questions</p>
                                        <button
                                            type="button"
                                            disabled={archived || !session || !enrolled || starting}
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
                                                    <summary>
                                                        {quiz.quizTitle}
                                                        {renderProgress(
                                                            quiz.lessonQuizId,
                                                            quiz.quizId,
                                                        )}
                                                    </summary>
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
                        </>
                    )}
                </>
            )}
            {error ? <p role="alert">{error}</p> : null}
        </section>
    );
}
