import { quizContentSchema, type QuizContent, type QuizDetail } from "@quiz-builder/contracts";
import { useQuery } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { getQuestion, listManagedQuestions, listTags } from "../api/questions";
import { useAuth } from "../auth/auth-state";

type DraftQuestion = QuizContent["questions"][number] & {
    prompt: string;
};

function contentFromQuiz(quiz: QuizDetail): QuizContent {
    return {
        title: quiz.title,
        description: quiz.description,
        settings: quiz.settings,
        questions: quiz.questions.map((question) => ({
            questionId: question.questionId,
            points: question.points,
            required: question.required,
            timeLimitSeconds: question.timeLimitSeconds,
        })),
    };
}

export function QuizEditor({
    initial,
    busy,
    submitLabel,
    onSave,
}: {
    initial?: QuizDetail;
    busy: boolean;
    submitLabel: string;
    onSave: (content: QuizContent) => Promise<void>;
}) {
    const [title, setTitle] = useState(initial?.title ?? "");
    const [description, setDescription] = useState(initial?.description ?? "");
    const [shuffleQuestions, setShuffleQuestions] = useState(
        initial?.settings.shuffleQuestions ?? false,
    );
    const [showAnswers, setShowAnswers] = useState(
        initial?.settings.showAnswersAfterCompletion ?? true,
    );
    const [questions, setQuestions] = useState<DraftQuestion[]>(
        initial?.questions.map((question) => ({
            questionId: question.questionId,
            points: question.points,
            required: question.required,
            timeLimitSeconds: question.timeLimitSeconds,
            prompt: question.question.prompt,
        })) ?? [],
    );
    const [pickerIndex, setPickerIndex] = useState<number | null>(null);
    const [message, setMessage] = useState("");

    function updateQuestion(index: number, change: Partial<DraftQuestion>) {
        setQuestions((previous) =>
            previous.map((question, position) =>
                position === index ? { ...question, ...change } : question,
            ),
        );
        setMessage("");
    }

    function currentContent(): QuizContent {
        return {
            title,
            description: description.trim() ? description : null,
            settings: { shuffleQuestions, showAnswersAfterCompletion: showAnswers },
            questions: questions.map(({ questionId, points, required, timeLimitSeconds }) => ({
                questionId,
                points,
                required,
                timeLimitSeconds,
            })),
        };
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const parsed = quizContentSchema.safeParse(currentContent());
        if (!parsed.success) {
            setMessage(parsed.error.issues[0]?.message ?? "Check the quiz content.");
            return;
        }
        if (initial && JSON.stringify(parsed.data) === JSON.stringify(contentFromQuiz(initial))) {
            setMessage("No changes to save.");
            return;
        }
        setMessage("");
        try {
            await onSave(parsed.data);
            setMessage("Quiz saved.");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not save quiz.");
        }
    }

    return (
        <form className="form-grid" onSubmit={(event) => void submit(event)}>
            <label>
                Quiz title
                <input value={title} onChange={(event) => setTitle(event.target.value)} required />
            </label>
            <label>
                Description
                <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={3}
                />
            </label>
            <fieldset className="quiz-fieldset">
                <legend>Settings</legend>
                <label className="checkbox-row">
                    <input
                        type="checkbox"
                        checked={shuffleQuestions}
                        onChange={(event) => setShuffleQuestions(event.target.checked)}
                    />
                    Shuffle questions for each attempt
                </label>
                <label className="checkbox-row">
                    <input
                        type="checkbox"
                        checked={showAnswers}
                        onChange={(event) => setShowAnswers(event.target.checked)}
                    />
                    Show answers after completion
                </label>
            </fieldset>
            <section aria-label="Quiz questions">
                <h2>Questions</h2>
                <p className="muted small">Adding a question permanently locks its content.</p>
                {questions.length ? (
                    <ol className="quiz-question-list">
                        {questions.map((question, index) => (
                            <li className="question-card" key={`${question.questionId}-${index}`}>
                                <strong>{question.prompt}</strong>
                                <div className="filter-grid">
                                    <label>
                                        Points for question {index + 1}
                                        <input
                                            type="number"
                                            min="0"
                                            step="any"
                                            value={question.points}
                                            onChange={(event) =>
                                                updateQuestion(index, {
                                                    points: Number(event.target.value),
                                                })
                                            }
                                            required
                                        />
                                    </label>
                                    <label>
                                        Time limit in seconds for question {index + 1}
                                        <input
                                            type="number"
                                            min="1"
                                            step="1"
                                            placeholder="No limit"
                                            value={question.timeLimitSeconds ?? ""}
                                            onChange={(event) =>
                                                updateQuestion(index, {
                                                    timeLimitSeconds: event.target.value
                                                        ? Number(event.target.value)
                                                        : null,
                                                })
                                            }
                                        />
                                    </label>
                                </div>
                                <label className="checkbox-row">
                                    <input
                                        type="checkbox"
                                        checked={question.required}
                                        onChange={(event) =>
                                            updateQuestion(index, {
                                                required: event.target.checked,
                                            })
                                        }
                                    />
                                    Required
                                </label>
                                <div className="quiz-actions">
                                    <button
                                        type="button"
                                        className="secondary"
                                        onClick={() => setPickerIndex(index)}
                                    >
                                        Change question
                                    </button>
                                    <button
                                        type="button"
                                        className="secondary"
                                        disabled={index === 0}
                                        onClick={() => {
                                            setQuestions((previous) => {
                                                const next = [...previous];
                                                [next[index - 1], next[index]] = [
                                                    next[index]!,
                                                    next[index - 1]!,
                                                ];
                                                return next;
                                            });
                                        }}
                                    >
                                        Move up
                                    </button>
                                    <button
                                        type="button"
                                        className="secondary"
                                        disabled={index === questions.length - 1}
                                        onClick={() => {
                                            setQuestions((previous) => {
                                                const next = [...previous];
                                                [next[index], next[index + 1]] = [
                                                    next[index + 1]!,
                                                    next[index]!,
                                                ];
                                                return next;
                                            });
                                        }}
                                    >
                                        Move down
                                    </button>
                                    <button
                                        type="button"
                                        className="secondary"
                                        onClick={() =>
                                            setQuestions((previous) =>
                                                previous.filter(
                                                    (_, position) => position !== index,
                                                ),
                                            )
                                        }
                                    >
                                        Remove
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p className="muted">No questions yet. Add one from the My questions.</p>
                )}
                <button
                    type="button"
                    className="secondary"
                    onClick={() => setPickerIndex(questions.length)}
                >
                    Add question
                </button>
                {pickerIndex !== null ? (
                    <QuestionPicker
                        onClose={() => setPickerIndex(null)}
                        onSelect={(selected) => {
                            setQuestions((previous) => {
                                const next = [...previous];
                                if (pickerIndex === previous.length) next.push(selected);
                                else
                                    next[pickerIndex] = {
                                        ...selected,
                                        points: previous[pickerIndex]!.points,
                                        required: previous[pickerIndex]!.required,
                                        timeLimitSeconds: previous[pickerIndex]!.timeLimitSeconds,
                                    };
                                return next;
                            });
                            setPickerIndex(null);
                            setMessage("");
                        }}
                    />
                ) : null}
            </section>
            {message ? <p role="status">{message}</p> : null}
            <button type="submit" disabled={busy}>
                {busy ? "Saving…" : submitLabel}
            </button>
        </form>
    );
}

function QuestionPicker({
    onClose,
    onSelect,
}: {
    onClose: () => void;
    onSelect: (q: DraftQuestion) => void;
}) {
    const { session } = useAuth();
    const [tag, setTag] = useState("");
    const [offset, setOffset] = useState(0);
    const [search, setSearch] = useState("");
    const [knownId, setKnownId] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const questions = useQuery({
        queryKey: ["questions", "mine", session?.user.id, tag, offset],
        queryFn: () => listManagedQuestions({ ...(tag ? { tag } : {}), offset }),
    });
    const tags = useQuery({ queryKey: ["tags", session?.user.id], queryFn: listTags });
    function select(q: { id: string; prompt: string }) {
        onSelect({
            questionId: q.id,
            prompt: q.prompt,
            points: 1,
            required: true,
            timeLimitSeconds: null,
        });
    }
    async function addKnown() {
        setError("");
        setLoading(true);
        try {
            select(await getQuestion(knownId.trim()));
        } catch (e) {
            setError(e instanceof Error ? e.message : "Question unavailable");
        } finally {
            setLoading(false);
        }
    }
    return (
        <div className="panel quiz-picker" aria-label="Question picker">
            <div className="section-heading">
                <h3>Choose a question</h3>
                <button type="button" className="secondary" onClick={onClose}>
                    Close
                </button>
            </div>
            <div className="filter-grid">
                <label>
                    Search prompts
                    <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </label>
                <label>
                    Tag
                    <select
                        value={tag}
                        onChange={(e) => {
                            setTag(e.target.value);
                            setOffset(0);
                        }}
                    >
                        <option value="">All tags</option>
                        {tags.data?.map((t) => (
                            <option key={t.id} value={t.slug}>
                                {t.name}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            {questions.isPending ? <p role="status">Loading questions…</p> : null}
            {questions.isError ? <p role="alert">{questions.error.message}</p> : null}
            {questions.data ? (
                <>
                    <ul className="card-list">
                        {questions.data.items
                            .filter((q) => q.prompt.toLowerCase().includes(search.toLowerCase()))
                            .map((q) => (
                                <li key={q.id}>
                                    <button
                                        type="button"
                                        className="secondary"
                                        onClick={() => select(q)}
                                    >
                                        {q.prompt}
                                    </button>
                                </li>
                            ))}
                    </ul>
                    <div className="pagination">
                        <button
                            type="button"
                            disabled={offset === 0}
                            onClick={() => setOffset(Math.max(0, offset - 50))}
                        >
                            Previous
                        </button>
                        <span>Page {Math.floor(offset / 50) + 1}</span>
                        <button
                            type="button"
                            disabled={questions.data.nextOffset === null}
                            onClick={() => setOffset(questions.data.nextOffset ?? offset)}
                        >
                            Next
                        </button>
                    </div>
                </>
            ) : null}
            <label>
                Public question ID
                <input
                    value={knownId}
                    onChange={(e) => setKnownId(e.target.value)}
                    placeholder="Question UUID"
                />
            </label>
            <button
                type="button"
                disabled={!knownId.trim() || loading}
                onClick={() => void addKnown()}
            >
                Add by ID
            </button>
            {error ? <p role="alert">{error}</p> : null}
        </div>
    );
}
