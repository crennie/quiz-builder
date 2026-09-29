import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import type { CreateFeedbackBody } from "@quiz-builder/contracts";

import { createFeedback } from "../api/feedback";

const categories = [
    ["incorrect_answer", "Incorrect answer"],
    ["ambiguous_question", "Ambiguous question"],
    ["typo", "Typo"],
    ["bad_choices", "Bad choices"],
    ["unfair_grading", "Unfair grading"],
    ["too_easy", "Too easy"],
    ["too_hard", "Too hard"],
    ["other", "Other"],
] as const;

export function FeedbackForm({
    target,
    label,
}: {
    target: { quizId: string } | { quizAttemptQuestionId: string };
    label: string;
}) {
    const [category, setCategory] = useState<CreateFeedbackBody["category"]>("other");
    const [comment, setComment] = useState("");
    const [message, setMessage] = useState("");
    const mutation = useMutation({ mutationFn: createFeedback });

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setMessage("");
        try {
            await mutation.mutateAsync({ ...target, category, comment: comment.trim() });
            setComment("");
            setMessage("Feedback sent. Thank you.");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not send feedback.");
        }
    }

    return (
        <details className="feedback-panel">
            <summary>{label}</summary>
            <form className="form-grid" onSubmit={(event) => void submit(event)}>
                <label>
                    Category
                    <select
                        value={category}
                        onChange={(event) =>
                            setCategory(event.target.value as CreateFeedbackBody["category"])
                        }
                    >
                        {categories.map(([value, name]) => (
                            <option key={value} value={value}>
                                {name}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    Feedback
                    <textarea
                        value={comment}
                        onChange={(event) => setComment(event.target.value)}
                        required
                        maxLength={5000}
                        rows={3}
                    />
                </label>
                <button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending ? "Sending…" : "Send feedback"}
                </button>
                {message ? (
                    <p
                        role={mutation.isError ? "alert" : "status"}
                        className={mutation.isError ? "error-text" : undefined}
                    >
                        {message}
                    </p>
                ) : null}
            </form>
        </details>
    );
}
