import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import type { AttemptDetail, UserResponse } from "@quiz-builder/contracts";

import { completeAttempt, getAttempt, submitAnswer } from "../api/attempts";
import { useAuth } from "../auth/auth-state";
import { FeedbackForm } from "../components/feedback-form";

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
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const [questionIndex, setQuestionIndex] = useState<number | null>(null);
    const [actionError, setActionError] = useState("");
    const queryKey = ["attempt", session?.user.id, attemptId] as const;
    const attempt = useQuery({ queryKey, queryFn: () => getAttempt(attemptId) });
    const answer = useMutation({
        mutationFn: ({ questionId, response }: { questionId: string; response: UserResponse }) =>
            submitAnswer(attemptId, questionId, response),
    });
    const complete = useMutation({ mutationFn: () => completeAttempt(attemptId) });

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
    const canComplete = current.questions.every(
        (question) => !question.required || question.userResponse !== null,
    );

    return (
        <div className="page-stack narrow">
            <div className="page-heading">
                <div>
                    <p className="eyebrow">In progress</p>
                    <h1>{current.quizTitle}</h1>
                </div>
                <Link to="/attempts">Attempt history</Link>
            </div>
            <p className="muted" role="status">
                {answeredCount} of {current.questions.length} answered. Your saved answers are
                available after a refresh.
            </p>
            {selected ? (
                <section className="panel" aria-label={`Question ${selectedIndex + 1}`}>
                    <p className="eyebrow">
                        Question {selectedIndex + 1} of {current.questions.length}
                    </p>
                    <h2>{selected.prompt}</h2>
                    <p className="muted small">
                        {selected.pointsPossible} points ·{" "}
                        {selected.required ? "Required" : "Optional"}
                        {selected.timeLimitSeconds
                            ? ` · Suggested time ${selected.timeLimitSeconds} seconds`
                            : ""}
                    </p>
                    {selected.userResponse ? (
                        <div className="message-panel">
                            <p>
                                <strong>Your saved answer:</strong> {responseText(selected)}
                            </p>
                            <p className="muted small">
                                Scores and review appear after completion.
                            </p>
                        </div>
                    ) : (
                        <AnswerForm
                            key={selected.id}
                            question={selected}
                            busy={answer.isPending}
                            onSave={(response) => saveAnswer(selected.id, response)}
                        />
                    )}
                    <div className="pagination">
                        <button
                            type="button"
                            className="secondary"
                            disabled={selectedIndex === 0 || answer.isPending}
                            onClick={() => setQuestionIndex(selectedIndex - 1)}
                        >
                            Previous
                        </button>
                        <span>
                            {selectedIndex + 1} / {current.questions.length}
                        </span>
                        <button
                            type="button"
                            className="secondary"
                            disabled={
                                selectedIndex === current.questions.length - 1 || answer.isPending
                            }
                            onClick={() => setQuestionIndex(selectedIndex + 1)}
                        >
                            Next
                        </button>
                    </div>
                    <FeedbackForm
                        target={{ quizAttemptQuestionId: selected.id }}
                        label={`Send feedback about question ${selectedIndex + 1}`}
                    />
                </section>
            ) : null}
            <section className="panel">
                <h2>Finish attempt</h2>
                <p className="muted small">
                    Required questions must be answered. Optional questions may be left blank.
                    Completion records your result.
                </p>
                <button
                    type="button"
                    disabled={!canComplete || answer.isPending || complete.isPending}
                    onClick={() => void finish()}
                >
                    {complete.isPending ? "Completing…" : "Complete quiz"}
                </button>
                {actionError ? (
                    <p role="alert" className="error-text">
                        {actionError}
                    </p>
                ) : null}
            </section>
        </div>
    );
}

function AnswerForm({
    question,
    busy,
    onSave,
}: {
    question: AttemptQuestion;
    busy: boolean;
    onSave: (response: UserResponse) => Promise<void>;
}) {
    const [text, setText] = useState("");
    const [single, setSingle] = useState("");
    const [multiple, setMultiple] = useState<string[]>([]);
    const [error, setError] = useState("");
    const canSubmit =
        question.questionType === "exact_text"
            ? text.trim().length > 0
            : question.questionType === "multiple_choice_single"
              ? single.length > 0
              : multiple.length > 0;

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canSubmit) return;
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
        <form className="form-grid" onSubmit={(event) => void submit(event)}>
            {question.questionType === "exact_text" ? (
                <label>
                    Your answer
                    <input
                        type="text"
                        value={text}
                        onChange={(event) => setText(event.target.value)}
                        required
                        autoComplete="off"
                    />
                </label>
            ) : (
                <fieldset className="quiz-fieldset">
                    <legend>
                        {question.questionType === "multiple_choice_single"
                            ? "Choose one answer"
                            : "Choose all that apply"}
                    </legend>
                    {question.options?.map((option) => (
                        <label className="checkbox-row" key={option.id}>
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
                                        setSingle(option.id);
                                    else {
                                        const checked = event.target.checked;
                                        setMultiple((previous) =>
                                            checked
                                                ? [...previous, option.id]
                                                : previous.filter((id) => id !== option.id),
                                        );
                                    }
                                }}
                            />
                            {option.text}
                        </label>
                    ))}
                </fieldset>
            )}
            <button type="submit" disabled={!canSubmit || busy}>
                {busy ? "Saving answer…" : "Submit answer"}
            </button>
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

function ResultView({ attempt }: { attempt: AttemptDetail }) {
    const score = attempt.scoreSummary;
    const percentage =
        score && score.pointsPossible > 0
            ? Math.round((score.pointsAwarded / score.pointsPossible) * 100)
            : null;
    const showAnswers = attempt.settings.showAnswersAfterCompletion;
    return (
        <div className="page-stack narrow">
            <Link to="/attempts">← Attempt history</Link>
            <div>
                <p className="eyebrow">Completed attempt</p>
                <h1>{attempt.quizTitle}</h1>
            </div>
            <section className="panel" aria-label="Result summary">
                <h2>Result</h2>
                <p className="result-score">
                    {score
                        ? `${score.pointsAwarded} / ${score.pointsPossible} points`
                        : "Score unavailable"}
                </p>
                {percentage !== null ? <p>{percentage}%</p> : null}
                <p className="muted small">
                    Completed{" "}
                    {attempt.completedAt ? new Date(attempt.completedAt).toLocaleString() : ""}
                </p>
                <Link to="/quizzes/$quizId" params={{ quizId: attempt.quizId }}>
                    Quiz details
                </Link>
            </section>
            <section aria-label="Question review">
                <h2>Question review</h2>
                {!showAnswers ? (
                    <p className="muted">Correct answers are hidden for this quiz.</p>
                ) : null}
                <ol className="quiz-question-list">
                    {attempt.questions.map((question, index) => (
                        <li className="question-card" key={question.id}>
                            <h3>{question.prompt}</h3>
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
                                · {question.pointsAwarded ?? 0} / {question.pointsPossible} points
                            </p>
                            {showAnswers && question.correctAnswer ? (
                                <p>
                                    <strong>Correct answer:</strong> {correctAnswerText(question)}
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
