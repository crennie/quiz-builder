import { usePlatformAdmin } from "../api/use-platform-admin";
import { useState } from "react";
import { useCourseProgress } from "../api/use-course-progress";
import { CourseEnrollment } from "../components/course-enrollment";
import { ArchiveCourseButton } from "../components/archive-course-button";
import type { LessonSummary } from "@quiz-builder/contracts";
import { listLessonAttempts } from "../api/attempts";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { getCourse, listCourseLessons, listLessonQuizzes } from "../api/courses";
import { useAuth } from "../auth/auth-state";
import styles from "./course-pages.module.css";

export function CourseDetailPage() {
    const { courseId } = useParams({ from: "/courses/$courseId" });
    const { session } = useAuth();
    return <CourseDetailContent key={`${courseId}:${session?.user.id ?? "anonymous"}`} />;
}
function CourseDetailContent() {
    const isPlatformAdmin = usePlatformAdmin();
    const { courseId } = useParams({ from: "/courses/$courseId" });
    const { session } = useAuth();
    const [editing, setEditing] = useState(false);
    const course = useQuery({ queryKey: ["course", courseId], queryFn: () => getCourse(courseId) });
    const lessons = useInfiniteQuery({
        queryKey: ["course-lessons", courseId],
        queryFn: ({ pageParam }) => listCourseLessons(courseId, pageParam),
        initialPageParam: 0,
        getNextPageParam: (page) => page.nextOffset ?? undefined,
        enabled: course.isSuccess,
    });
    const progress = useCourseProgress(courseId);
    const canRead =
        isPlatformAdmin || (!!session && !!progress.data?.enrollment && !progress.isError);
    const items = lessons.data?.pages.flatMap((page) => page.items) ?? [];
    return (
        <div className="page-stack">
            <Link to="/courses">← Courses</Link>
            {course.isPending ? <p role="status">Loading course…</p> : null}
            {course.isError ? (
                <div className="message-panel" role="alert">
                    <p>{course.error.message}</p>
                    <button onClick={() => void course.refetch()}>Try again</button>
                </div>
            ) : null}
            {course.data ? (
                <>
                    <header className={`panel ${styles.overview}`}>
                        <p className="eyebrow">Course overview</p>
                        <div className={styles.titleRow}>
                            <h1 title={course.data.title}>{course.data.title}</h1>
                            {isPlatformAdmin && !course.data.archivedAt ? (
                                <button
                                    type="button"
                                    className="text-button"
                                    aria-label={editing ? "Done editing course" : "Edit course"}
                                    aria-pressed={editing}
                                    onClick={() => setEditing(!editing)}
                                >
                                    {editing ? (
                                        "Done"
                                    ) : (
                                        <>
                                            <span aria-hidden="true">✎</span> Edit
                                        </>
                                    )}
                                </button>
                            ) : null}
                        </div>
                        {course.data.archivedAt ? (
                            <p role="status">
                                This course is archived. Restore it to edit lessons or start new
                                attempts.
                            </p>
                        ) : null}
                        <CourseEnrollment course={course.data} />
                        {isPlatformAdmin ? <ArchiveCourseButton course={course.data} /> : null}
                        {course.data.description ? (
                            <p className={styles.description}>{course.data.description}</p>
                        ) : null}
                        {canRead && items[0] ? (
                            <Link
                                className="button"
                                to="/courses/$courseId/lessons/$lessonId"
                                params={{ courseId, lessonId: items[0].id }}
                            >
                                Start reading <span aria-hidden="true"> →</span>
                            </Link>
                        ) : null}
                    </header>
                    <section className="page-stack" aria-labelledby="course-lessons-title">
                        <div className="section-heading">
                            <h2 id="course-lessons-title">Lessons</h2>
                            {isPlatformAdmin && editing && !course.data.archivedAt ? (
                                <Link to="/courses/$courseId/import" params={{ courseId }}>
                                    Import lessons
                                </Link>
                            ) : null}
                        </div>
                        {lessons.isPending ? <p role="status">Loading lessons…</p> : null}
                        {lessons.isError ? (
                            <div role="alert" className="message-panel">
                                <p>{lessons.error.message}</p>
                                <button onClick={() => void lessons.refetch()}>Try again</button>
                            </div>
                        ) : null}
                        {lessons.isSuccess && !items.length ? (
                            <div className="message-panel">
                                <p>This course has no lessons yet.</p>
                            </div>
                        ) : null}
                        {!canRead ? (
                            <p className="muted">Enroll in this course to read its lessons.</p>
                        ) : null}
                        <ol className={styles.lessonList}>
                            {items.map((lesson, index) => (
                                <li key={lesson.id}>
                                    {canRead ? (
                                        <Link
                                            className={styles.lessonCard}
                                            to="/courses/$courseId/lessons/$lessonId"
                                            params={{ courseId, lessonId: lesson.id }}
                                        >
                                            <span
                                                className={styles.lessonNumber}
                                                aria-hidden="true"
                                            >
                                                {String(index + 1).padStart(2, "0")}
                                            </span>
                                            <div>
                                                <h3>{lesson.title}</h3>
                                                {lesson.description ? (
                                                    <p className={styles.excerpt}>
                                                        {lesson.description}
                                                    </p>
                                                ) : null}
                                                {progress.data?.enrollment ? (
                                                    <p className="small">
                                                        {progress.data.completedLessons.some(
                                                            (item) => item.lessonId === lesson.id,
                                                        )
                                                            ? "✓ Lesson complete"
                                                            : "Lesson not completed"}
                                                    </p>
                                                ) : null}
                                                <LessonQuizProgress lesson={lesson} />
                                            </div>
                                            <span aria-hidden="true">→</span>
                                        </Link>
                                    ) : (
                                        <div className={styles.lessonCard}>
                                            <span className={styles.lessonNumber}>
                                                {String(index + 1).padStart(2, "0")}
                                            </span>
                                            <h3>{lesson.title}</h3>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ol>
                        {lessons.hasNextPage ? (
                            <button
                                className="secondary"
                                disabled={lessons.isFetchingNextPage}
                                onClick={() => void lessons.fetchNextPage()}
                            >
                                {lessons.isFetchingNextPage ? "Loading…" : "Load more lessons"}
                            </button>
                        ) : null}
                    </section>
                </>
            ) : null}
        </div>
    );
}

function LessonQuizProgress({ lesson }: { lesson: LessonSummary }) {
    const { session } = useAuth();
    const quizzes = useQuery({
        queryKey: ["lesson-quizzes", lesson.id, session?.user.id, lesson.updatedAt],
        queryFn: () => listLessonQuizzes(lesson.id),
    });
    const attempts = useQuery({
        queryKey: ["attempts", session?.user.id, "lesson", lesson.id, "all"],
        queryFn: () => listLessonAttempts(lesson.id),
        enabled: !!session,
    });
    if (quizzes.isError || (session && attempts.isError))
        return <p className="muted small">Quiz progress unavailable</p>;
    if (quizzes.isPending || (session && attempts.isPending))
        return <p className="muted small">Loading quiz progress…</p>;
    const total = quizzes.data.length;
    if (!session)
        return <p className="muted small">{total} quizzes · Sign in to see your progress</p>;
    const completedIds = new Set(
        attempts.data
            ?.filter((attempt) => attempt.status === "completed")
            .map((attempt) => attempt.lessonQuizId),
    );
    const completed = quizzes.data.filter((quiz) => completedIds.has(quiz.id)).length;
    return (
        <p
            className={
                total > 0 && completed === total ? "lesson-quiz-completed small" : "muted small"
            }
        >
            {total > 0 && completed === total ? <span aria-hidden="true">✓ </span> : null}
            {completed} / {total} quizzes completed
        </p>
    );
}
