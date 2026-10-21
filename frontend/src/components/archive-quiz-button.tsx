import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { QuizDetail } from "@quiz-builder/contracts";

import { setQuizArchived } from "../api/quizzes";
import styles from "./archive-quiz-button.module.css";

export function ArchiveQuizButton({
    quiz,
    disabled = false,
    onArchived,
}: {
    quiz: QuizDetail;
    disabled?: boolean;
    onArchived?: () => Promise<void>;
}) {
    const client = useQueryClient();
    const archive = useMutation({
        mutationFn: () => setQuizArchived(quiz.id, !quiz.archivedAt),
        onSuccess: async (updated) => {
            await onArchived?.();
            client.setQueryData(["quiz", quiz.createdBy, quiz.id], updated);
            await client.invalidateQueries({ queryKey: ["quizzes"] });
        },
    });
    if (!quiz.isOwner || quiz.visibility !== "private") return null;
    return (
        <div className={styles.container}>
            <button
                type="button"
                className={styles.button}
                aria-label={`${quiz.archivedAt ? "Restore" : "Archive"} quiz: ${quiz.title}`}
                disabled={disabled || archive.isPending}
                onClick={() => archive.mutate()}
            >
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    aria-hidden="true"
                >
                    <path d="M3 3h18v4H3zM5 7v14h14V7M9 11h6" />
                </svg>
                {archive.isPending ? "Saving…" : quiz.archivedAt ? "Restore quiz" : "Archive quiz"}
            </button>
            {archive.isError ? (
                <p role="alert" className="error-text small">
                    {archive.error.message}
                </p>
            ) : null}
        </div>
    );
}
