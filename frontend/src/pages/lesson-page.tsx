import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { getCourse, getLesson } from "../api/courses";
import { LessonContent } from "../components/lesson-content";
import { parseLessonContent } from "../components/lesson-markdown";
import styles from "./course-pages.module.css";

export function LessonPage() {
    const { courseId, lessonId } = useParams({ from: "/courses/$courseId/lessons/$lessonId" });
    const lesson = useQuery({ queryKey: ["lesson", lessonId], queryFn: () => getLesson(lessonId) });
    const course = useQuery({ queryKey: ["course", courseId], queryFn: () => getCourse(courseId) });
    const data = lesson.data;
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
            <div className={styles.readingLayout}>
                <article className={`panel ${styles.article}`} aria-labelledby="lesson-title">
                    <header className={styles.articleHeader}>
                        <p className="eyebrow">
                            Lesson {data.position + 1} <span aria-hidden="true">·</span> {minutes}{" "}
                            min read
                        </p>
                        <h1 id="lesson-title">{data.title}</h1>
                        {data.description ? (
                            <p className={styles.description}>{data.description}</p>
                        ) : null}
                    </header>
                    <LessonContent content={data.content} headingIdPrefix="lesson" />
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
                                        <a href={`#lesson-${heading.id}`}>{heading.text}</a>
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
