import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Course } from "@quiz-builder/contracts";

import { setCourseArchived } from "../api/courses";
import styles from "./archive-quiz-button.module.css";

export function ArchiveCourseButton({
    course,
    disabled = false,
    onArchived,
}: {
    course: Course;
    disabled?: boolean;
    onArchived?: () => Promise<void>;
}) {
    const client = useQueryClient();
    const archive = useMutation({
        mutationFn: () => setCourseArchived(course.id, !course.archivedAt),
        onSuccess: async (updated) => {
            await onArchived?.();
            client.setQueryData(["course", course.id], updated);
            await client.invalidateQueries({ queryKey: ["courses"] });
        },
    });
    return (
        <div className={styles.container}>
            <button
                type="button"
                className={styles.button}
                aria-label={`${course.archivedAt ? "Restore" : "Archive"} course: ${course.title}`}
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
                {archive.isPending
                    ? "Saving…"
                    : course.archivedAt
                      ? "Restore course"
                      : "Archive course"}
            </button>
            {archive.isError ? (
                <p role="alert" className="error-text small">
                    {archive.error.message}
                </p>
            ) : null}
        </div>
    );
}
