import { usePlatformAdmin } from "../api/use-platform-admin";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    COURSE_CONTENT_MAX_BYTES,
    courseImportFileSchema,
    lessonImportFileSchema,
    type CourseImportFile,
    type LessonImportFile,
    type CourseImportResult,
} from "@quiz-builder/contracts";
import { getCourse, importCourse, importLessons } from "../api/courses";
import { LessonContent } from "../components/lesson-content";
import { Modal } from "../components/modal";
import styles from "./course-pages.module.css";

export function ImportCoursePage({ courseId }: { courseId?: string }) {
    const isPlatformAdmin = usePlatformAdmin();
    const navigate = useNavigate();
    const client = useQueryClient();
    const course = useQuery({
        queryKey: ["course", courseId],
        queryFn: () => getCourse(courseId!),
        enabled: !!courseId,
    });
    const [preview, setPreview] = useState<CourseImportFile | LessonImportFile | null>(null);
    const [reading, setReading] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [importOpen, setImportOpen] = useState(false);
    const [status, setStatus] = useState("");
    const importKey = useRef("");
    const result = useRef<CourseImportResult | null>(null);
    const readVersion = useRef(0);
    const noun = courseId ? "lessons" : "course";

    async function readFile(file: File | undefined) {
        const version = ++readVersion.current;
        setPreview(null);
        setError("");
        setStatus("");
        result.current = null;
        if (!file) {
            setReading(false);
            return;
        }
        setReading(true);
        try {
            if (file.size > COURSE_CONTENT_MAX_BYTES)
                throw new Error("Choose a JSON file no larger than 1 MiB.");
            const value: unknown = JSON.parse(await file.text());
            const parsed = courseId
                ? lessonImportFileSchema.safeParse(value)
                : courseImportFileSchema.safeParse(value);
            if (!parsed.success) {
                const issue = parsed.error.issues[0];
                throw new Error(
                    `${issue?.path.join(".") || "File"}: ${issue?.message ?? "Invalid import file"}`,
                );
            }
            const key = crypto.randomUUID();
            if (
                new TextEncoder().encode(JSON.stringify({ importKey: key, content: parsed.data }))
                    .length > COURSE_CONTENT_MAX_BYTES
            )
                throw new Error(
                    "The expanded JSON exceeds the 1 MiB import request limit. Shorten the content or split it into smaller imports.",
                );
            if (version === readVersion.current) {
                importKey.current = key;
                setPreview(parsed.data);
            }
        } catch (error) {
            if (version === readVersion.current)
                setError(error instanceof Error ? error.message : "Could not read JSON file.");
        } finally {
            if (version === readVersion.current) setReading(false);
        }
    }

    async function importContent() {
        if (!preview || busy) return;
        setBusy(true);
        setImportOpen(true);
        setError("");
        setStatus(`Importing ${noun}…`);
        try {
            if (!result.current) {
                result.current = courseId
                    ? await importLessons(courseId, importKey.current, preview)
                    : await importCourse(importKey.current, courseImportFileSchema.parse(preview));
            }
            setStatus("Your content is ready. Opening course…");
            await Promise.all([
                client.invalidateQueries({ queryKey: ["courses"] }),
                client.invalidateQueries({ queryKey: ["course", result.current.courseId] }),
                client.invalidateQueries({ queryKey: ["course-lessons", result.current.courseId] }),
                client.invalidateQueries({ queryKey: ["lesson"] }),
            ]);
            await navigate({
                to: "/courses/$courseId",
                params: { courseId: result.current.courseId },
            });
        } catch (error) {
            setError(error instanceof Error ? error.message : `Could not import ${noun}.`);
            setStatus(
                result.current
                    ? "Your content was created. Retry to open the course."
                    : "You can retry safely; this import will not create duplicate content.",
            );
        } finally {
            setBusy(false);
        }
    }

    if (!isPlatformAdmin)
        return <p>Platform administrator access is required to import courses or lessons.</p>;

    return (
        <div className="page-stack narrow">
            {courseId ? (
                <Link to="/courses/$courseId" params={{ courseId }}>
                    ← Course overview
                </Link>
            ) : (
                <Link to="/courses">← Courses</Link>
            )}
            <header className="page-heading">
                <div>
                    <p className="eyebrow">Share something worth learning</p>
                    <h1>Import {noun}</h1>
                    <p className="muted">
                        {courseId
                            ? `Add lessons to ${course.data?.title ?? "this course"}, in the order they appear in your file.`
                            : "Create a public course from a JSON file, with its lessons in reading order."}
                    </p>
                </div>
            </header>
            {courseId && course.isPending ? <p role="status">Loading course…</p> : null}
            {courseId && course.isError ? (
                <div className="message-panel" role="alert">
                    <p>{course.error.message}</p>
                    <button onClick={() => void course.refetch()}>Try again</button>
                </div>
            ) : null}
            {course.data?.archivedAt ? (
                <p role="status">Restore this course before importing lessons.</p>
            ) : null}
            <section className="panel form-grid">
                <h2>Choose a file</h2>
                <p className="muted">
                    {courseId ? "Import 1–100 lessons" : "Import a course with up to 100 lessons"}{" "}
                    from a JSON file up to 1 MiB. Lessons support plain text and basic Markdown:
                    headings, paragraphs, lists, quotes, links, emphasis, and code blocks. Each
                    lesson may include a quizzes array using the same JSON formats as quiz import.
                </p>
                <a
                    href={`${import.meta.env.BASE_URL}sample-${courseId ? "lessons" : "course"}.json`}
                    download
                >
                    {courseId ? "Download example lessons" : "Download example course with lessons"}
                </a>
                <p className="muted small">
                    Course and lesson content will be publicly readable.{" "}
                    {courseId
                        ? "New lessons are appended after the existing lessons."
                        : "A course may start without lessons."}
                </p>
                <label>
                    {courseId ? "Lessons" : "Course"} JSON file
                    <input
                        type="file"
                        accept=".json,application/json"
                        disabled={busy || reading || (!!courseId && !course.isSuccess)}
                        onChange={(event) => void readFile(event.target.files?.[0])}
                    />
                </label>
                {reading ? <p role="status">Reading file…</p> : null}
            </section>
            {preview ? (
                <section className="panel form-grid">
                    <h2>{"title" in preview ? preview.title : "Review lessons"}</h2>
                    {"description" in preview && preview.description ? (
                        <p>{preview.description}</p>
                    ) : null}
                    <p className="muted">
                        {preview.lessons.length}{" "}
                        {preview.lessons.length === 1 ? "lesson" : "lessons"} · Public learning
                        content
                    </p>
                    {preview.lessons.length ? (
                        <ol>
                            {preview.lessons.map((lesson, index) => (
                                <li key={index}>
                                    <details>
                                        <summary>
                                            {lesson.title} · {lesson.quizzes?.length ?? 0} quizzes
                                        </summary>
                                        {lesson.description ? <p>{lesson.description}</p> : null}
                                        <div className={styles.preview}>
                                            <LessonContent content={lesson.content} />
                                            {lesson.quizzes?.map((quiz, quizIndex) => (
                                                <p key={quizIndex}>
                                                    {quiz.title} · {quiz.questions.length} questions
                                                </p>
                                            ))}
                                        </div>
                                    </details>
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p>You can import lessons into this course later.</p>
                    )}
                    <button
                        type="button"
                        disabled={busy || reading || !!course.data?.archivedAt}
                        onClick={() => void importContent()}
                    >
                        {busy ? "Importing…" : `Import public ${noun}`}
                    </button>
                </section>
            ) : null}
            {error && !importOpen ? (
                <p className="error-text" role="alert">
                    {error}
                </p>
            ) : null}
            <Modal
                open={importOpen}
                title={busy ? `Importing ${noun}` : "Import needs attention"}
                onClose={() => setImportOpen(false)}
                dismissible={!busy}
            >
                <div className="form-grid">
                    {busy ? <progress aria-label="Import progress" /> : null}
                    {status ? <p role="status">{status}</p> : null}
                    {busy ? (
                        <p className="muted">Keep this page open while we save your content.</p>
                    ) : null}
                    {error ? (
                        <p className="error-text" role="alert">
                            {error}
                        </p>
                    ) : null}
                    {!busy ? (
                        <button onClick={() => void importContent()}>Retry import</button>
                    ) : null}
                </div>
            </Modal>
        </div>
    );
}

export function ImportLessonsPage() {
    const { courseId } = useParams({ from: "/courses/$courseId/import" });
    return <ImportCoursePage key={courseId} courseId={courseId} />;
}
