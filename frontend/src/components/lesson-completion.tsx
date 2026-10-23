import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { setLessonProgress } from "../api/courses";
import { useCourseProgress } from "../api/use-course-progress";
import { useAuth } from "../auth/auth-state";

export function LessonCompletion({
    courseId,
    lessonId,
    archived,
    compact = false,
}: {
    courseId: string;
    lessonId: string;
    archived: boolean;
    compact?: boolean;
}) {
    const { session } = useAuth();
    const progress = useCourseProgress(courseId);
    const client = useQueryClient();
    const completed =
        progress.data?.completedLessons.some((lesson) => lesson.lessonId === lessonId) ?? false;
    const mutationKey = ["lesson-completion", session?.user.id, lessonId];
    const saving = useIsMutating({ mutationKey }) > 0;
    const save = useMutation({
        mutationKey,
        mutationFn: (checked: boolean) => setLessonProgress(lessonId, checked),
        onSuccess: async () => {
            await Promise.all([
                client.invalidateQueries({
                    queryKey: ["course-progress", session?.user.id, courseId],
                }),
                client.invalidateQueries({ queryKey: ["my-courses", session?.user.id] }),
            ]);
        },
    });
    if (!session || !progress.data?.enrollment) return null;
    return (
        <section
            className={compact ? undefined : "lesson-completion-panel"}
            aria-label="Lesson completion"
        >
            <label
                className={`checkbox-row learning-status ${completed ? "learning-status-complete" : ""}`}
            >
                <input
                    type="checkbox"
                    checked={completed}
                    disabled={archived || saving || progress.isError}
                    onChange={(event) => save.mutate(event.target.checked)}
                />
                Lesson complete
            </label>
            {saving ? (
                <span role="status" className="muted small">
                    Saving…
                </span>
            ) : null}
            {!compact ? (
                <p className="muted small">
                    You decide when this lesson is complete. Quiz results do not change this status.
                </p>
            ) : null}
            {save.isError ? <p role="alert">{save.error.message}</p> : null}
        </section>
    );
}
