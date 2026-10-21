import { useState } from "react";
import { useBlocker } from "@tanstack/react-router";
import {
    lessonQuizContentSchema,
    saveLessonBodySchema,
    type Lesson,
    type LessonQuiz,
    type LessonQuizContent,
} from "@quiz-builder/contracts";
import { saveLesson } from "../api/courses";
import { parseQuizFile } from "../import/quiz-file";
import { QuestionEditor } from "./question-editor";

type DraftQuiz = { key: string; id?: string; content: LessonQuizContent };
export function LessonEditor({
    lesson,
    quizzes,
    onDone,
}: {
    lesson: Lesson;
    quizzes: LessonQuiz[];
    onDone: () => void;
}) {
    const [title, setTitle] = useState(lesson.title);
    const [description, setDescription] = useState(lesson.description ?? "");
    const [content, setContent] = useState(lesson.content);
    const [drafts, setDrafts] = useState<DraftQuiz[]>(() =>
        quizzes.map((entry) => ({
            key: entry.id,
            id: entry.id,
            content: {
                title: entry.quiz.title,
                description: entry.quiz.description,
                settings: entry.quiz.settings,
                questions: entry.quiz.questions.map((q) => ({
                    content: q.question,
                    points: q.points,
                    required: q.required,
                    timeLimitSeconds: q.timeLimitSeconds,
                })),
            },
        })),
    );
    const [questionEdit, setQuestionEdit] = useState<{ key: string; index: number } | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    useBlocker({
        shouldBlockFn: () => busy || !window.confirm("Discard your unsaved lesson changes?"),
        enableBeforeUnload: true,
    });
    function update(key: string, update: Partial<LessonQuizContent>) {
        setDrafts((items) =>
            items.map((q) => (q.key === key ? { ...q, content: { ...q.content, ...update } } : q)),
        );
    }
    function move(index: number, delta: number) {
        setDrafts((items) => {
            const next = [...items];
            [next[index], next[index + delta]] = [next[index + delta]!, next[index]!];
            return next;
        });
    }
    async function importFile(file: File) {
        setError("");
        setBusy(true);
        try {
            if (file.size > 256_000) throw new Error("Choose a JSON file smaller than 256 KB.");
            const value: unknown = JSON.parse(await file.text());
            const document = lessonQuizContentSchema.safeParse(value);
            const imported = document.success
                ? document.data
                : (() => {
                      const parsed = parseQuizFile(value);
                      return lessonQuizContentSchema.parse({
                          title: parsed.artifact.topic,
                          description: parsed.description,
                          settings: { shuffleQuestions: false, showAnswersAfterCompletion: true },
                          questions: parsed.artifact.questions.map((q) => ({
                              content: q.content,
                              points: 1,
                              required: true,
                              timeLimitSeconds: null,
                          })),
                      });
                  })();
            setDrafts((items) => [...items, { key: crypto.randomUUID(), content: imported }]);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not import quiz.");
        } finally {
            setBusy(false);
        }
    }
    async function save() {
        setError("");
        setBusy(true);
        try {
            const body = saveLessonBodySchema.parse({
                title,
                description: description.trim() || null,
                content,
                expectedUpdatedAt: lesson.updatedAt,
                quizzes: drafts.map((q) =>
                    q.id ? { id: q.id, content: q.content } : { import: q.content },
                ),
            });
            await saveLesson(lesson.id, body);
            onDone();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not save lesson.");
        } finally {
            setBusy(false);
        }
    }
    return (
        <section className="panel page-stack" aria-label="Edit lesson">
            <h1>Edit lesson</h1>
            <p>
                Changes, including quiz imports and removals, are published when you save. Cancel
                discards this draft.
            </p>
            <fieldset disabled={busy} className="form-grid">
                <legend>Lesson content</legend>
                <label>
                    Title
                    <input
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        maxLength={300}
                    />
                </label>
                <label>
                    Description
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                    />
                </label>
                <label>
                    Lesson content (Markdown)
                    <textarea
                        rows={18}
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                    />
                </label>
            </fieldset>
            <h2>Lesson quizzes</h2>
            <p>
                Import a quiz JSON file, then edit it below. Quiz edits preserve previous attempts
                and results.
            </p>
            <a href="/sample-quiz.json" download>
                Download example quiz
            </a>
            <label>
                Import quiz
                <input
                    type="file"
                    accept=".json,application/json"
                    disabled={busy || !!questionEdit}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = "";
                        if (file) void importFile(file);
                    }}
                />
            </label>
            {drafts.map((draft, index) => (
                <fieldset className="form-grid" key={draft.key} disabled={busy}>
                    <legend>Quiz {index + 1}</legend>
                    <label>
                        Quiz title
                        <input
                            value={draft.content.title}
                            onChange={(e) => update(draft.key, { title: e.target.value })}
                        />
                    </label>
                    <label>
                        Quiz description
                        <textarea
                            value={draft.content.description ?? ""}
                            onChange={(e) =>
                                update(draft.key, { description: e.target.value || null })
                            }
                        />
                    </label>
                    <label className="checkbox-row">
                        <input
                            type="checkbox"
                            checked={draft.content.settings.shuffleQuestions}
                            onChange={(e) =>
                                update(draft.key, {
                                    settings: {
                                        ...draft.content.settings,
                                        shuffleQuestions: e.target.checked,
                                    },
                                })
                            }
                        />
                        Shuffle questions
                    </label>
                    <label className="checkbox-row">
                        <input
                            type="checkbox"
                            checked={draft.content.settings.showAnswersAfterCompletion}
                            onChange={(e) =>
                                update(draft.key, {
                                    settings: {
                                        ...draft.content.settings,
                                        showAnswersAfterCompletion: e.target.checked,
                                    },
                                })
                            }
                        />
                        Show answers after completion
                    </label>
                    <ol className="card-list">
                        {draft.content.questions.map((q, qi) => (
                            <li key={qi} className="panel">
                                <p>{q.content.prompt}</p>
                                {questionEdit?.key === draft.key && questionEdit.index === qi ? (
                                    <>
                                        <QuestionEditor
                                            initial={q.content}
                                            busy={busy}
                                            submitLabel="Apply to draft"
                                            onSave={(updated) => {
                                                update(draft.key, {
                                                    questions: draft.content.questions.map(
                                                        (item, i) =>
                                                            i === qi
                                                                ? { ...item, content: updated }
                                                                : item,
                                                    ),
                                                });
                                                setQuestionEdit(null);
                                                return Promise.resolve();
                                            }}
                                        />
                                        <button
                                            type="button"
                                            className="secondary"
                                            onClick={() => setQuestionEdit(null)}
                                        >
                                            Cancel question edit
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <label>
                                            Points
                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                value={q.points}
                                                onChange={(e) =>
                                                    update(draft.key, {
                                                        questions: draft.content.questions.map(
                                                            (item, i) =>
                                                                i === qi
                                                                    ? {
                                                                          ...item,
                                                                          points: Number(
                                                                              e.target.value,
                                                                          ),
                                                                      }
                                                                    : item,
                                                        ),
                                                    })
                                                }
                                            />
                                        </label>
                                        <div className="quiz-actions">
                                            <button
                                                type="button"
                                                disabled={!!questionEdit}
                                                onClick={() =>
                                                    setQuestionEdit({ key: draft.key, index: qi })
                                                }
                                            >
                                                Edit question
                                            </button>
                                            <button
                                                type="button"
                                                disabled={!!questionEdit || qi === 0}
                                                onClick={() => {
                                                    const questions = [...draft.content.questions];
                                                    [questions[qi - 1], questions[qi]] = [
                                                        questions[qi]!,
                                                        questions[qi - 1]!,
                                                    ];
                                                    update(draft.key, { questions });
                                                }}
                                            >
                                                Move question up
                                            </button>
                                            <button
                                                type="button"
                                                disabled={
                                                    !!questionEdit ||
                                                    draft.content.questions.length === 1
                                                }
                                                onClick={() =>
                                                    update(draft.key, {
                                                        questions: draft.content.questions.filter(
                                                            (_, i) => i !== qi,
                                                        ),
                                                    })
                                                }
                                            >
                                                Remove question
                                            </button>
                                        </div>
                                    </>
                                )}
                            </li>
                        ))}
                    </ol>
                    <div className="quiz-actions">
                        <button
                            type="button"
                            disabled={!!questionEdit || index === 0}
                            onClick={() => move(index, -1)}
                        >
                            Move quiz up
                        </button>
                        <button
                            type="button"
                            disabled={!!questionEdit || index === drafts.length - 1}
                            onClick={() => move(index, 1)}
                        >
                            Move quiz down
                        </button>
                        <button
                            type="button"
                            disabled={!!questionEdit}
                            onClick={() =>
                                setDrafts((items) => items.filter((q) => q.key !== draft.key))
                            }
                        >
                            Remove quiz
                        </button>
                    </div>
                </fieldset>
            ))}
            {error ? (
                <p role="alert" className="error-text">
                    {error}
                </p>
            ) : null}
            {questionEdit ? (
                <p>Apply or cancel the question edit before saving the lesson.</p>
            ) : null}
            <div className="quiz-actions">
                <button type="button" disabled={busy || !!questionEdit} onClick={() => void save()}>
                    {busy ? "Saving…" : "Save lesson"}
                </button>
                <button type="button" className="secondary" disabled={busy} onClick={onDone}>
                    Cancel
                </button>
            </div>
        </section>
    );
}
