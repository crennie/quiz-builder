import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setLessonProgress } from "../api/courses";
import { useCourseProgress } from "../api/use-course-progress";
import { useAuth } from "../auth/auth-state";

export function LessonCompletion({
    courseId,
    lessonId,
    archived,
}: {
    courseId: string;
    lessonId: string;
    archived: boolean;
}) {
    const { session } = useAuth();
    const progress = useCourseProgress(courseId);
    const client = useQueryClient();
    const completed =
        progress.data?.completedLessons.some((lesson) => lesson.lessonId === lessonId) ?? false;
    const save = useMutation({
        mutationFn: () => setLessonProgress(lessonId, !completed),
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
        <section aria-label="Lesson completion">
            <p role="status">{completed ? "Lesson complete" : "Lesson not completed"}</p>
            <button
                type="button"
                disabled={archived || save.isPending || progress.isError}
                onClick={() => save.mutate()}
            >
                {save.isPending
                    ? "Saving…"
                    : completed
                      ? "Mark as incomplete"
                      : "Mark lesson complete"}
            </button>
            <p className="muted small">
                You decide when this lesson is complete. Quiz results do not change this status.
            </p>
            {save.isError ? <p role="alert">{save.error.message}</p> : null}
        </section>
    );
}
