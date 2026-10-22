import { useState } from "react";
import { ArchiveCourseButton } from "../components/archive-course-button";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { listCourses } from "../api/courses";
import { useAuth } from "../auth/auth-state";
import styles from "./course-pages.module.css";

export function CoursesPage() {
    const { session } = useAuth();
    const [showArchived, setShowArchived] = useState(false);
    const archived = !!session && showArchived;
    const courses = useInfiniteQuery({
        queryKey: ["courses", session?.user.id, archived],
        queryFn: ({ pageParam }) => listCourses(pageParam, archived),
        initialPageParam: 0,
        getNextPageParam: (page) => page.nextOffset ?? undefined,
    });
    const items = courses.data?.pages.flatMap((page) => page.items) ?? [];
    return (
        <section className="page-stack">
            <header className="page-heading">
                <div>
                    <p className="eyebrow">Explore & learn</p>
                    <h1>Courses</h1>
                    <p className="muted">
                        Make room for a new idea. Explore a course, one lesson at a time.
                    </p>
                </div>
                {session ? (
                    <Link className="button" to="/courses/import">
                        Import course
                    </Link>
                ) : null}
            </header>
            {session ? (
                <label>
                    <input
                        type="checkbox"
                        checked={archived}
                        onChange={(event) => setShowArchived(event.target.checked)}
                    />{" "}
                    Show archived courses
                </label>
            ) : null}
            {courses.isPending ? <p role="status">Loading courses…</p> : null}
            {courses.isError ? (
                <div className="message-panel" role="alert">
                    <p>Could not load courses. {courses.error.message}</p>
                    <button onClick={() => void courses.refetch()}>Try again</button>
                </div>
            ) : null}
            {courses.isSuccess && !items.length ? (
                <div className="message-panel">
                    <h2>A place for your next discovery</h2>
                    <p>
                        {archived
                            ? "No archived courses."
                            : "No courses yet. Import a course to share something worth learning."}
                    </p>
                    {!session ? <Link to="/sign-in">Sign in to import a course</Link> : null}
                </div>
            ) : null}
            <ul className={styles.grid} aria-label="Courses">
                {items.map((course) => (
                    <li key={course.id}>
                        <Link
                            className={styles.card}
                            to="/courses/$courseId"
                            params={{ courseId: course.id }}
                        >
                            <span className="eyebrow">Course</span>
                            <h2>{course.title}</h2>
                            <p className={styles.excerpt}>
                                {course.description || "Explore the lessons in this course."}
                            </p>
                            <span className={styles.cardAction}>
                                Explore course <span aria-hidden="true">→</span>
                            </span>
                        </Link>
                        {session ? <ArchiveCourseButton course={course} /> : null}
                    </li>
                ))}
            </ul>
            {courses.hasNextPage ? (
                <button
                    className="secondary"
                    disabled={courses.isFetchingNextPage}
                    onClick={() => void courses.fetchNextPage()}
                >
                    {courses.isFetchingNextPage ? "Loading…" : "Load more courses"}
                </button>
            ) : null}
        </section>
    );
}
