import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useBlocker, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { AttemptDetail, UserResponse } from "@quiz-builder/contracts";

import { completeAttempt, getAttempt, submitAnswer } from "../api/attempts";
import { useAuth } from "../auth/auth-state";
import { FeedbackForm } from "../components/feedback-form";
import styles from "./attempt-page.module.css";

type AttemptQuestion = AttemptDetail["questions"][number];

function responseText(question: AttemptQuestion): string {
    const response = question.userResponse;
    if (!response) return "No answer submitted";
    if (response.questionType === "exact_text") return response.text;
    if (response.questionType === "multiple_choice_single") {
        return (
            question.options?.find((option) => option.id === response.optionId)?.text ??
            "Selected choice"
        );
    }
    return response.optionIds
        .map(
            (id) => question.options?.find((option) => option.id === id)?.text ?? "Selected choice",
        )
        .join(", ");
}

function correctAnswerText(question: AttemptQuestion): string | null {
    const answer = question.correctAnswer;
    if (!answer) return null;
    if (answer.questionType === "exact_text") return answer.acceptedAnswers.join(" / ");
    if (answer.questionType === "multiple_choice_single") {
        return answer.options.find((option) => option.id === answer.correctOptionId)?.text ?? null;
    }
    return answer.correctOptionIds
        .map((id) => answer.options.find((option) => option.id === id)?.text ?? "")
        .filter(Boolean)
        .join(", ");
}

export function AttemptPage() {
    const { attemptId } = useParams({ from: "/attempts/$attemptId" });
    return <AttemptPlayer key={attemptId} attemptId={attemptId} />;
}

function AttemptPlayer({ attemptId }: { attemptId: string }) {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const [questionIndex, setQuestionIndex] = useState<number | null>(null);
    const [actionError, setActionError] = useState("");
    const [drafts, setDrafts] = useState<Record<string, UserResponse>>({});
    const queryKey = ["attempt", session?.user.id, attemptId] as const;
    const attempt = useQuery({ queryKey, queryFn: () => getAttempt(attemptId) });
    const answer = useMutation({
        mutationFn: ({ questionId, response }: { questionId: string; response: UserResponse }) =>
            submitAnswer(attemptId, questionId, response),
    });
    const complete = useMutation({ mutationFn: () => completeAttempt(attemptId) });
    const inProgress = attempt.data?.status === "in_progress";
    const busy = answer.isPending || complete.isPending;
    useBlocker({
        shouldBlockFn: ({ current, next }) =>
            current.pathname !== next.pathname &&
            !window.confirm(
                "Leave this quiz? Submitted answers are saved, but any unsubmitted answer will be lost.",
            ),
        disabled: !inProgress,
        enableBeforeUnload: inProgress,
    });

    function updateAttempt(updated: AttemptDetail) {
        queryClient.setQueryData(queryKey, updated);
        void queryClient.invalidateQueries({ queryKey: ["attempts", session?.user.id] });
    }

    async function saveAnswer(questionId: string, response: UserResponse) {
        const updated = await answer.mutateAsync({ questionId, response });
        updateAttempt(updated);
        const next = updated.questions.findIndex((question) => question.userResponse === null);
        if (next >= 0) setQuestionIndex(next);
    }

    async function finish() {
        setActionError("");
        try {
            updateAttempt(await complete.mutateAsync());
        } catch (error) {
            setActionError(error instanceof Error ? error.message : "Could not complete quiz.");
        }
    }

    if (attempt.isPending) return <p role="status">Loading attempt…</p>;
    if (attempt.isError)
        return (
            <div className="message-panel" role="alert">
                <h1>Attempt unavailable</h1>
                <p>{attempt.error.message}</p>
                <Link to="/attempts">Return to history</Link>
            </div>
        );

    const current = attempt.data;
    if (current.status === "completed") return <ResultView attempt={current} />;
    if (current.status !== "in_progress")
        return (
            <div className="page-stack narrow">
                <Link to="/attempts">← Attempt history</Link>
                <h1>{current.quizTitle}</h1>
                <div className="message-panel">
                    <p>This attempt is {current.status} and cannot be continued.</p>
                </div>
                <Link to="/quizzes/$quizId" params={{ quizId: current.quizId }}>
                    Quiz details
                </Link>
            </div>
        );

    const firstUnanswered = current.questions.findIndex(
        (question) => question.userResponse === null,
    );
    const selectedIndex = questionIndex ?? (firstUnanswered >= 0 ? firstUnanswered : 0);
    const selected = current.questions[selectedIndex];
    const answeredCount = current.questions.filter(
        (question) => question.userResponse !== null,
    ).length;
    const canComplete = answeredCount === current.questions.length;

    return (
        <div className={styles.player}>
            <header className={styles.header}>
                <h1>{current.quizTitle}</h1>
                <Link to="/attempts">Leave quiz</Link>
            </header>
            {selected ? (
                <section className={styles.stage} aria-label={`Question ${selectedIndex + 1}`}>
                    <div className={styles.progress}>
                        <span>
                            Question {selectedIndex + 1} of {current.questions.length}
                        </span>
                        <span>{answeredCount} answered</span>
                    </div>
                    <QuestionPrompt key={selected.id} prompt={selected.prompt} />
                    {selected.userResponse ? (
                        <div className="message-panel">
                            <p>
                                <strong>Your saved answer:</strong> {responseText(selected)}
                            </p>
                            <p className="muted small">
                                Submitted answers cannot be changed. Results appear after you finish
                                the quiz.
                            </p>
                        </div>
                    ) : (
                        <AnswerForm
                            key={selected.id}
                            question={selected}
                            busy={busy}
                            draft={drafts[selected.id]}
                            onDraft={(draft) =>
                                setDrafts((previous) => ({ ...previous, [selected.id]: draft }))
                            }
                            onSave={(response) => saveAnswer(selected.id, response)}
                        />
                    )}
                    <div className="pagination">
                        <button
                            type="button"
                            className="secondary"
                            disabled={selectedIndex === 0 || busy}
                            onClick={() => setQuestionIndex(selectedIndex - 1)}
                        >
                            Previous
                        </button>
                        <button
                            type="button"
                            className="secondary"
                            disabled={
                                !selected.userResponse ||
                                selectedIndex === current.questions.length - 1 ||
                                busy
                            }
                            onClick={() => setQuestionIndex(selectedIndex + 1)}
                        >
                            Next
                        </button>
                    </div>
                </section>
            ) : null}
            {canComplete ? (
                <section className="panel" aria-label="Finish quiz">
                    <h2>All questions answered</h2>
                    <p className="muted">
                        Review your saved answers, or finish to see your total result.
                    </p>
                    <button type="button" disabled={busy} onClick={() => void finish()}>
                        {complete.isPending ? "Completing…" : "Show results"}
                    </button>
                    {actionError ? (
                        <p role="alert" className="error-text">
                            {actionError}
                        </p>
                    ) : null}
                </section>
            ) : null}
        </div>
    );
}

function QuestionPrompt({ prompt }: { prompt: string }) {
    const heading = useRef<HTMLHeadingElement>(null);
    useEffect(() => {
        heading.current?.focus();
    }, []);
    return (
        <h2 ref={heading} tabIndex={-1} className={styles.prompt}>
            {prompt}
        </h2>
    );
}

function AnswerForm({
    question,
    busy,
    draft,
    onDraft,
    onSave,
}: {
    question: AttemptQuestion;
    busy: boolean;
    draft: UserResponse | undefined;
    onDraft: (response: UserResponse) => void;
    onSave: (response: UserResponse) => Promise<void>;
}) {
    const text = draft?.questionType === "exact_text" ? draft.text : "";
    const single = draft?.questionType === "multiple_choice_single" ? draft.optionId : "";
    const multiple = draft?.questionType === "multiple_choice_multi" ? draft.optionIds : [];
    const [error, setError] = useState("");
    const canSubmit =
        question.questionType === "exact_text"
            ? text.trim().length > 0
            : question.questionType === "multiple_choice_single"
              ? single.length > 0
              : multiple.length > 0;

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canSubmit || busy) return;
        const response: UserResponse =
            question.questionType === "exact_text"
                ? { questionType: "exact_text", text }
                : question.questionType === "multiple_choice_single"
                  ? { questionType: "multiple_choice_single", optionId: single }
                  : { questionType: "multiple_choice_multi", optionIds: multiple };
        setError("");
        try {
            await onSave(response);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not save answer.");
        }
    }

    return (
        <form className={styles.form} onSubmit={(event) => void submit(event)}>
            {question.questionType === "exact_text" ? (
                <label className={styles.textAnswer}>
                    Your answer
                    <input
                        type="text"
                        value={text}
                        onChange={(event) =>
                            onDraft({ questionType: "exact_text", text: event.target.value })
                        }
                        required
                        autoComplete="off"
                        disabled={busy}
                    />
                </label>
            ) : (
                <fieldset className={styles.answers} disabled={busy}>
                    <legend>
                        {question.questionType === "multiple_choice_single"
                            ? "Choose one answer"
                            : "Choose all that apply"}
                    </legend>
                    <div className={styles.grid}>
                        {question.options?.map((option) => (
                            <label className={styles.choice} key={option.id}>
                                <input
                                    type={
                                        question.questionType === "multiple_choice_single"
                                            ? "radio"
                                            : "checkbox"
                                    }
                                    name={
                                        question.questionType === "multiple_choice_single"
                                            ? "answer"
                                            : undefined
                                    }
                                    value={option.id}
                                    checked={
                                        question.questionType === "multiple_choice_single"
                                            ? single === option.id
                                            : multiple.includes(option.id)
                                    }
                                    onChange={(event) => {
                                        if (question.questionType === "multiple_choice_single")
                                            onDraft({
                                                questionType: "multiple_choice_single",
                                                optionId: option.id,
                                            });
                                        else {
                                            const checked = event.target.checked;
                                            onDraft({
                                                questionType: "multiple_choice_multi",
                                                optionIds: checked
                                                    ? [...multiple, option.id]
                                                    : multiple.filter((id) => id !== option.id),
                                            });
                                        }
                                    }}
                                />
                                <span>{option.text}</span>
                            </label>
                        ))}
                    </div>
                </fieldset>
            )}
            <div className={styles.actions}>
                <button type="submit" disabled={!canSubmit || busy}>
                    {busy ? "Saving answer…" : "Submit answer"}
                </button>
            </div>
            <p className="muted small">
                Submit to save your answer before moving to another question.
            </p>
            {error ? (
                <p role="alert" className="error-text">
                    {error}
                </p>
            ) : null}
        </form>
    );
}

function letterGrade(percentage: number): string {
    const scale: [number, string][] = [
        [97, "A+"],
        [93, "A"],
        [90, "A−"],
        [87, "B+"],
        [83, "B"],
        [80, "B−"],
        [77, "C+"],
        [73, "C"],
        [70, "C−"],
        [67, "D+"],
        [63, "D"],
        [60, "D−"],
    ];
    return scale.find(([minimum]) => percentage >= minimum)?.[1] ?? "F";
}

function ResultView({ attempt }: { attempt: AttemptDetail }) {
    const score = attempt.scoreSummary;
    const percentage =
        score && score.pointsPossible > 0
            ? (score.pointsAwarded / score.pointsPossible) * 100
            : null;
    const showAnswers = attempt.settings.showAnswersAfterCompletion;
    return (
        <div className="page-stack narrow">
            <Link to="/attempts">← Attempt history</Link>
            <div>
                <p className="eyebrow">Completed attempt</p>
                <h1>
                    <Link to="/quizzes/$quizId" params={{ quizId: attempt.quizId }}>
                        {attempt.quizTitle}
                    </Link>
                </h1>
            </div>
            <section className="panel" aria-label="Result summary">
                <p className="muted small">
                    Submitted{" "}
                    {attempt.completedAt ? new Date(attempt.completedAt).toLocaleString() : "—"}
                </p>
                <p className="result-score">
                    {score
                        ? `${score.pointsAwarded} / ${score.pointsPossible} points`
                        : "Score unavailable"}
                </p>
                <p className={styles.percentage}>
                    {percentage !== null
                        ? `${Number(percentage.toFixed(2))}%`
                        : "Percentage unavailable"}
                </p>
                <p className={styles.grade}>
                    <span className="sr-only">Letter grade: </span>
                    {percentage !== null ? letterGrade(percentage) : "Not graded"}
                </p>
            </section>
            <section aria-label="Question review">
                <h2>Question review</h2>
                {!showAnswers ? (
                    <p className="muted">Correct answers are hidden for this quiz.</p>
                ) : null}
                <ol className={styles.reviewList}>
                    {attempt.questions.map((question, index) => (
                        <li key={question.id}>
                            <details
                                className={styles.reviewItem}
                                open={!question.evaluationResult?.isCorrect}
                            >
                                <summary>
                                    <span
                                        className={styles.reviewIcon}
                                        data-correct={question.evaluationResult?.isCorrect ?? false}
                                    >
                                        <span aria-hidden="true">
                                            {question.evaluationResult?.isCorrect ? "✓" : "✕"}
                                        </span>
                                        <span className="sr-only">
                                            {question.evaluationResult?.isCorrect
                                                ? "Correct"
                                                : question.evaluationResult
                                                  ? "Incorrect"
                                                  : "Not answered"}
                                        </span>
                                    </span>
                                    <span>
                                        {index + 1}. {question.prompt}
                                    </span>
                                </summary>
                                <div className={styles.reviewBody}>
                                    <p>
                                        <strong>Your answer:</strong> {responseText(question)}
                                    </p>
                                    <p>
                                        <strong>Result:</strong>{" "}
                                        {question.evaluationResult
                                            ? question.evaluationResult.isCorrect
                                                ? "Correct"
                                                : "Incorrect"
                                            : "Not answered"}{" "}
                                        · {question.pointsAwarded ?? 0} / {question.pointsPossible}{" "}
                                        points
                                    </p>
                                    {showAnswers && question.correctAnswer ? (
                                        <p>
                                            <strong>Correct answer:</strong>{" "}
                                            {correctAnswerText(question)}
                                        </p>
                                    ) : null}
                                    {showAnswers && question.explanation ? (
                                        <p>
                                            <strong>Explanation:</strong> {question.explanation}
                                        </p>
                                    ) : null}
                                    <FeedbackForm
                                        target={{ quizAttemptQuestionId: question.id }}
                                        label={`Send feedback about question ${index + 1}`}
                                    />
                                </div>
                            </details>
                        </li>
                    ))}
                </ol>
            </section>
            <section className="panel">
                <h2>About this quiz</h2>
                <FeedbackForm
                    target={{ quizId: attempt.quizId }}
                    label="Send feedback about this quiz"
                />
            </section>
        </div>
    );
}
