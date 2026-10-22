import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { Course } from "@quiz-builder/contracts";
import { enrollInCourse } from "../api/courses";
import { useCourseProgress } from "../api/use-course-progress";
import { useAuth } from "../auth/auth-state";

export function CourseEnrollment({ course }: { course: Course }) {
    const { session } = useAuth();
    const progress = useCourseProgress(course.id);
    const client = useQueryClient();
    const enroll = useMutation({
        mutationFn: () => enrollInCourse(course.id),
        onSuccess: async () => {
            await Promise.all([
                client.invalidateQueries({
                    queryKey: ["course-progress", session?.user.id, course.id],
                }),
                client.invalidateQueries({ queryKey: ["my-courses", session?.user.id] }),
            ]);
        },
    });
    if (!session) return <Link to="/sign-in">Sign in to enroll</Link>;
    if (progress.isPending) return <p role="status">Loading enrollment…</p>;
    if (progress.isError)
        return (
            <div role="alert">
                <p>{progress.error.message}</p>
                <button onClick={() => void progress.refetch()}>Retry enrollment status</button>
            </div>
        );
    if (progress.data.enrollment)
        return (
            <p role="status">
                Enrolled · <Link to="/courses/mine">My Courses</Link>
            </p>
        );
    if (course.archivedAt) return <p className="muted">Restore this course to enroll.</p>;
    return (
        <div>
            <button
                type="button"
                disabled={enroll.isPending}
                onClick={() => enroll.mutate()}
                aria-label={`Enroll in ${course.title}`}
            >
                {enroll.isPending ? "Enrolling…" : "Enroll"}
            </button>
            {enroll.isError ? <p role="alert">{enroll.error.message}</p> : null}
        </div>
    );
}
