import { useCourseProgress } from "../api/use-course-progress";
import { CourseEnrollment } from "../components/course-enrollment";
import { LessonCompletion } from "../components/lesson-completion";
import { useEffect, useState } from "react";
import type { Lesson, LessonQuiz } from "@quiz-builder/contracts";
import { useAuth } from "../auth/auth-state";
import { LessonEditor } from "../components/lesson-editor";
import { LessonPractice } from "../components/lesson-practice";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { getCourse, getLesson, listLessonQuizzes } from "../api/courses";
import { LessonContent } from "../components/lesson-content";
import { parseLessonContent } from "../components/lesson-markdown";
import styles from "./course-pages.module.css";

export function LessonPage() {
    const { lessonId } = useParams({ from: "/courses/$courseId/lessons/$lessonId" });
    const { session } = useAuth();
    return <LessonPageContent key={`${lessonId}:${session?.user.id ?? "anonymous"}`} />;
}
function LessonPageContent() {
    const { session } = useAuth();
    const client = useQueryClient();
    const [editing, setEditing] = useState<{ lesson: Lesson; quizzes: LessonQuiz[] } | null>(null);
    const [playing, setPlaying] = useState(false);
    const [activeHeading, setActiveHeading] = useState<string | null>(null);
    const { courseId, lessonId } = useParams({ from: "/courses/$courseId/lessons/$lessonId" });
    const progress = useCourseProgress(courseId);
    const lesson = useQuery({
        queryKey: ["lesson", lessonId],
        queryFn: () => getLesson(lessonId),
        enabled: !editing && !playing,
    });
    const course = useQuery({ queryKey: ["course", courseId], queryFn: () => getCourse(courseId) });
    const quizzes = useQuery({
        queryKey: ["lesson-quizzes", lessonId, lesson.data?.updatedAt],
        queryFn: () => listLessonQuizzes(lessonId),
        enabled: !!lesson.data && !editing && !playing,
    });
    const data = lesson.data;
    useEffect(() => {
        if (!data || editing) return;
        const headings = parseLessonContent(data.content)
            .filter((block) => block.kind === "heading")
            .map((heading) => document.getElementById(`lesson-${heading.id}`))
            .filter((heading): heading is HTMLElement => heading !== null);
        let frame = 0;
        const update = () => {
            frame = 0;
            const threshold = Math.min(160, window.innerHeight * 0.25);
            let current = headings[0];
            for (const heading of headings) {
                if (heading.getBoundingClientRect().top > threshold) break;
                current = heading;
            }
            setActiveHeading(current?.id ?? null);
        };
        const schedule = () => {
            if (!frame) frame = window.requestAnimationFrame(update);
        };
        schedule();
        window.addEventListener("scroll", schedule, { passive: true });
        window.addEventListener("resize", schedule);
        const observer = new ResizeObserver(schedule);
        const article = document.getElementById("lesson-title")?.closest("article");
        if (article) observer.observe(article);
        return () => {
            window.cancelAnimationFrame(frame);
            window.removeEventListener("scroll", schedule);
            window.removeEventListener("resize", schedule);
            observer.disconnect();
        };
    }, [data, editing]);
    if (editing)
        return (
            <LessonEditor
                lesson={editing.lesson}
                quizzes={editing.quizzes}
                onDone={() => {
                    setEditing(null);
                    void client.invalidateQueries({ queryKey: ["lesson", lessonId] });
                    void client.invalidateQueries({ queryKey: ["lesson-quizzes", lessonId] });
                    void client.invalidateQueries({ queryKey: ["course-lessons", courseId] });
                }}
            />
        );
    if (lesson.isPending) return <p role="status">Loading lesson…</p>;
    if (lesson.isError)
        return (
            <div className="message-panel" role="alert">
                <p>{lesson.error.message}</p>
                <button onClick={() => void lesson.refetch()}>Try again</button>
            </div>
        );
    if (!data || data.courseId !== courseId)
        return (
            <div className="message-panel">
                <h1>Lesson not found</h1>
                <p>This lesson does not belong to this course.</p>
                <Link to="/courses/$courseId" params={{ courseId }}>
                    Back to course
                </Link>
            </div>
        );
    const headings = parseLessonContent(data.content).filter((block) => block.kind === "heading");
    const minutes = Math.max(1, Math.ceil(data.content.trim().split(/\s+/u).length / 200));
    return (
        <div className="page-stack" key={lessonId}>
            <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
                <Link to="/courses">Courses</Link>
                <span aria-hidden="true">/</span>
                <Link to="/courses/$courseId" params={{ courseId }}>
                    {course.data?.title ?? "Course overview"}
                </Link>
                <span aria-hidden="true">/</span>
                <span aria-current="page">Lesson {data.position + 1}</span>
            </nav>
            {course.data?.archivedAt ? (
                <p role="status">
                    This course is archived. Existing attempts and results remain available.
                </p>
            ) : null}
            <div className={styles.readingLayout}>
                <div className={styles.readingMain}>
                    <div className={styles.learningStatus} aria-label="Your learning status">
                        {course.data ? (
                            <CourseEnrollment course={course.data} showMyCoursesLink={false} />
                        ) : null}
                        <LessonCompletion
                            courseId={courseId}
                            lessonId={lessonId}
                            archived={!course.data || !!course.data.archivedAt}
                            compact
                        />
                        <nav
                            className={styles.topLessonNavigation}
                            aria-label="Top lesson navigation"
                        >
                            {data.previousLesson ? (
                                <Link
                                    to="/courses/$courseId/lessons/$lessonId"
                                    params={{ courseId, lessonId: data.previousLesson.id }}
                                    title={data.previousLesson.title}
                                >
                                    ← Previous lesson
                                </Link>
                            ) : (
                                <Link to="/courses/$courseId" params={{ courseId }}>
                                    ← Course overview
                                </Link>
                            )}
                            {data.nextLesson ? (
                                <Link
                                    to="/courses/$courseId/lessons/$lessonId"
                                    params={{ courseId, lessonId: data.nextLesson.id }}
                                    title={data.nextLesson.title}
                                >
                                    Next lesson →
                                </Link>
                            ) : (
                                <Link to="/courses/$courseId" params={{ courseId }}>
                                    Back to course →
                                </Link>
                            )}
                        </nav>
                    </div>
                    <article className={`panel ${styles.article}`} aria-labelledby="lesson-title">
                        <header className={styles.articleHeader}>
                            {session ? (
                                <button
                                    type="button"
                                    className={`text-button ${styles.lessonEdit}`}
                                    aria-label="Edit lesson"
                                    disabled={
                                        !course.data ||
                                        !!course.data.archivedAt ||
                                        playing ||
                                        !quizzes.data ||
                                        quizzes.isFetching ||
                                        lesson.isFetching
                                    }
                                    onClick={() => {
                                        if (quizzes.data)
                                            setEditing({ lesson: data, quizzes: quizzes.data });
                                    }}
                                >
                                    <span aria-hidden="true">✎</span> Edit
                                </button>
                            ) : (
                                <p className="muted small">Sign in to edit this lesson.</p>
                            )}

                            <p className="eyebrow">
                                Lesson {data.position + 1} <span aria-hidden="true">·</span>{" "}
                                {minutes} min read
                            </p>
                            <h1 id="lesson-title">{data.title}</h1>
                            {data.description ? (
                                <p className={styles.description}>{data.description}</p>
                            ) : null}
                        </header>
                        <LessonContent content={data.content} headingIdPrefix="lesson" />
                        {quizzes.isPending ? <p role="status">Loading quizzes…</p> : null}
                        {quizzes.isError ? (
                            <div role="alert">
                                <p>{quizzes.error.message}</p>
                                <button onClick={() => void quizzes.refetch()}>
                                    Retry loading quizzes
                                </button>
                            </div>
                        ) : null}
                        {quizzes.data ? (
                            <LessonPractice
                                enrolled={!!progress.data?.enrollment && !progress.isError}
                                archived={!course.data || !!course.data.archivedAt}
                                lessonId={lessonId}
                                quizzes={quizzes.data}
                                onPlaying={setPlaying}
                            />
                        ) : null}
                        <LessonCompletion
                            key={lessonId}
                            courseId={courseId}
                            lessonId={lessonId}
                            archived={!course.data || !!course.data.archivedAt}
                        />
                        <nav className={styles.lessonNavigation} aria-label="Lesson navigation">
                            {data.previousLesson ? (
                                <Link
                                    to="/courses/$courseId/lessons/$lessonId"
                                    params={{ courseId, lessonId: data.previousLesson.id }}
                                >
                                    <span className="muted small">← Previous lesson</span>
                                    <strong>{data.previousLesson.title}</strong>
                                </Link>
                            ) : (
                                <Link to="/courses/$courseId" params={{ courseId }}>
                                    ← Course overview
                                </Link>
                            )}
                            {data.nextLesson ? (
                                <Link
                                    to="/courses/$courseId/lessons/$lessonId"
                                    params={{ courseId, lessonId: data.nextLesson.id }}
                                >
                                    <span className="muted small">Next lesson →</span>
                                    <strong>{data.nextLesson.title}</strong>
                                </Link>
                            ) : (
                                <Link to="/courses/$courseId" params={{ courseId }}>
                                    Back to course →
                                </Link>
                            )}
                        </nav>
                    </article>
                </div>
                <aside className={styles.readingAside} aria-label="Reading guide">
                    <Link to="/courses/$courseId" params={{ courseId }}>
                        View all lessons
                    </Link>
                    {headings.length ? (
                        <nav aria-label="On this page">
                            <h2>On this page</h2>
                            <ul>
                                {headings.map((heading) => (
                                    <li key={heading.id}>
                                        <a
                                            href={`#lesson-${heading.id}`}
                                            aria-current={
                                                activeHeading === `lesson-${heading.id}`
                                                    ? "location"
                                                    : undefined
                                            }
                                        >
                                            {heading.text}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        </nav>
                    ) : null}
                    <p className="muted small">
                        Take your time. Revisit any lesson whenever you need it.
                    </p>
                </aside>
            </div>
        </div>
    );
}
