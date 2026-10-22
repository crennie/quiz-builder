import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { listEnrolledCourses } from "../api/courses";
import { useAuth } from "../auth/auth-state";
import styles from "./course-pages.module.css";

export function MyCoursesPage() {
    const { session } = useAuth();
    const courses = useInfiniteQuery({
        queryKey: ["my-courses", session?.user.id],
        queryFn: ({ pageParam }) => listEnrolledCourses(pageParam),
        initialPageParam: 0,
        getNextPageParam: (page) => page.nextOffset ?? undefined,
        enabled: !!session,
    });
    const items = courses.data?.pages.flatMap((page) => page.items) ?? [];
    return (
        <section className="page-stack">
            <header className="page-heading">
                <div>
                    <p className="eyebrow">Your learning home</p>
                    <h1>My Courses</h1>
                    <p className="muted">
                        Pick up a course and keep learning, one lesson at a time.
                    </p>
                </div>
                <Link className="button" to="/courses">
                    Browse courses
                </Link>
            </header>
            {courses.isPending ? <p role="status">Loading your courses…</p> : null}
            {courses.isError ? (
                <div role="alert">
                    <p>{courses.error.message}</p>
                    <button onClick={() => void courses.refetch()}>Try again</button>
                </div>
            ) : null}
            {courses.isSuccess && !items.length ? (
                <div className="message-panel">
                    <h2>Your courses start here</h2>
                    <p>Enroll in a course to track your lesson progress and take its quizzes.</p>
                    <Link to="/courses">Find a course</Link>
                </div>
            ) : null}
            <ul className={styles.grid} aria-label="Enrolled courses">
                {items.map(({ course, completedLessons, totalLessons }) => (
                    <li key={course.id}>
                        <Link
                            className={styles.card}
                            to="/courses/$courseId"
                            params={{ courseId: course.id }}
                        >
                            <span className="eyebrow">
                                {course.archivedAt ? "Archived course" : "Enrolled course"}
                            </span>
                            <h2>{course.title}</h2>
                            {course.description ? (
                                <p className={styles.excerpt}>{course.description}</p>
                            ) : null}
                            <p>
                                {completedLessons} / {totalLessons} lessons complete
                            </p>
                            {totalLessons > 0 ? (
                                <progress
                                    aria-label={`${course.title} lesson progress`}
                                    value={completedLessons}
                                    max={totalLessons}
                                />
                            ) : (
                                <p className="muted small">No lessons yet.</p>
                            )}
                            <span className={styles.cardAction}>
                                {course.archivedAt ? "View course" : "Continue learning"} →
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
            {courses.hasNextPage ? (
                <button
                    disabled={courses.isFetchingNextPage}
                    onClick={() => void courses.fetchNextPage()}
                >
                    {courses.isFetchingNextPage ? "Loading…" : "Load more courses"}
                </button>
            ) : null}
        </section>
    );
}
