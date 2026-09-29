import {
    questionVersionContentSchema,
    type QuestionType,
    type QuestionVersionContent,
} from "@quiz-builder/contracts";
import { useState, type FormEvent } from "react";

import styles from "./question-editor.module.css";

type OptionDraft = { id: string; text: string; correct: boolean };
type Draft = {
    prompt: string;
    explanation: string;
    type: QuestionType;
    answers: string;
    caseSensitive: boolean;
    trimWhitespace: boolean;
    options: OptionDraft[];
};

function initialDraft(content?: QuestionVersionContent): Draft {
    const defaults = {
        prompt: content?.prompt ?? "",
        explanation: content?.explanation ?? "",
        type: content?.questionType ?? "exact_text",
        answers: "",
        caseSensitive: false,
        trimWhitespace: true,
        options: [
            { id: "a", text: "", correct: false },
            { id: "b", text: "", correct: false },
        ],
    } satisfies Draft;
    if (!content) return defaults;
    if (
        content.answerConfig.questionType === "exact_text" &&
        content.gradingConfig.questionType === "exact_text"
    ) {
        return {
            ...defaults,
            answers: content.answerConfig.acceptedAnswers.join("\n"),
            caseSensitive: content.gradingConfig.caseSensitive,
            trimWhitespace: content.gradingConfig.trimWhitespace,
        };
    }
    if (content.answerConfig.questionType === "multiple_choice_single") {
        const correctOptionId = content.answerConfig.correctOptionId;
        return {
            ...defaults,
            options: content.answerConfig.options.map((option) => ({
                ...option,
                correct: option.id === correctOptionId,
            })),
        };
    }
    if (content.answerConfig.questionType === "multiple_choice_multi") {
        const correctOptionIds = content.answerConfig.correctOptionIds;
        return {
            ...defaults,
            options: content.answerConfig.options.map((option) => ({
                ...option,
                correct: correctOptionIds.includes(option.id),
            })),
        };
    }
    return defaults;
}

function makeContent(draft: Draft): unknown {
    const base = {
        prompt: draft.prompt,
        questionType: draft.type,
        explanation: draft.explanation.trim() || null,
    };
    if (draft.type === "exact_text")
        return {
            ...base,
            answerConfig: {
                questionType: draft.type,
                acceptedAnswers: draft.answers
                    .split("\n")
                    .map((answer) => answer.trim())
                    .filter(Boolean),
            },
            gradingConfig: {
                questionType: draft.type,
                caseSensitive: draft.caseSensitive,
                trimWhitespace: draft.trimWhitespace,
            },
        };
    const options = draft.options.map(({ id, text }) => ({ id, text }));
    if (draft.type === "multiple_choice_single")
        return {
            ...base,
            answerConfig: {
                questionType: draft.type,
                options,
                correctOptionId: draft.options.find((option) => option.correct)?.id ?? "",
            },
            gradingConfig: { questionType: draft.type },
        };
    return {
        ...base,
        answerConfig: {
            questionType: draft.type,
            options,
            correctOptionIds: draft.options
                .filter((option) => option.correct)
                .map((option) => option.id),
        },
        gradingConfig: { questionType: draft.type },
    };
}

export function QuestionEditor({
    initial,
    submitLabel,
    busy,
    onSave,
}: {
    initial?: QuestionVersionContent;
    submitLabel: string;
    busy: boolean;
    onSave: (content: QuestionVersionContent) => Promise<void>;
}) {
    const [draft, setDraft] = useState<Draft>(() => initialDraft(initial));
    const [error, setError] = useState("");

    function updateOption(id: string, value: Partial<OptionDraft>) {
        setDraft((current) => ({
            ...current,
            options: current.options.map((option) =>
                option.id === id ? { ...option, ...value } : option,
            ),
        }));
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const result = questionVersionContentSchema.safeParse(makeContent(draft));
        if (!result.success) {
            setError(
                "Check the prompt and answer settings. Choices need text and a correct answer.",
            );
            return;
        }
        setError("");
        try {
            await onSave(result.data);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not save the question.");
        }
    }

    return (
        <form
            className={styles.editor}
            onSubmit={(event) => {
                void submit(event);
            }}
        >
            <label>
                Question prompt
                <textarea
                    required
                    rows={3}
                    value={draft.prompt}
                    onChange={(event) => setDraft({ ...draft, prompt: event.target.value })}
                />
            </label>
            <label>
                Question type
                <select
                    value={draft.type}
                    onChange={(event) =>
                        setDraft({
                            ...draft,
                            type: event.target.value as QuestionType,
                            options: [
                                { id: "a", text: "", correct: false },
                                { id: "b", text: "", correct: false },
                            ],
                        })
                    }
                >
                    <option value="exact_text">Exact text</option>
                    <option value="multiple_choice_single">Single choice</option>
                    <option value="multiple_choice_multi">Multiple choice</option>
                </select>
            </label>
            {draft.type === "exact_text" ? (
                <fieldset>
                    <legend>Accepted answers</legend>
                    <label>
                        One answer per line
                        <textarea
                            rows={4}
                            value={draft.answers}
                            onChange={(event) =>
                                setDraft({ ...draft, answers: event.target.value })
                            }
                        />
                    </label>
                    <label className={styles.inline}>
                        <input
                            type="checkbox"
                            checked={draft.caseSensitive}
                            onChange={(event) =>
                                setDraft({ ...draft, caseSensitive: event.target.checked })
                            }
                        />{" "}
                        Case sensitive
                    </label>
                    <label className={styles.inline}>
                        <input
                            type="checkbox"
                            checked={draft.trimWhitespace}
                            onChange={(event) =>
                                setDraft({ ...draft, trimWhitespace: event.target.checked })
                            }
                        />{" "}
                        Ignore leading and trailing spaces
                    </label>
                </fieldset>
            ) : (
                <fieldset>
                    <legend>Choices</legend>
                    <p className="muted">
                        {draft.type === "multiple_choice_single"
                            ? "Select one correct choice."
                            : "Select every correct choice."}
                    </p>
                    {draft.options.map((option, index) => (
                        <div className={styles.choice} key={option.id}>
                            <input
                                aria-label={`Choice ${index + 1}`}
                                value={option.text}
                                onChange={(event) =>
                                    updateOption(option.id, { text: event.target.value })
                                }
                            />
                            <label className={styles.inline}>
                                <input
                                    type={
                                        draft.type === "multiple_choice_single"
                                            ? "radio"
                                            : "checkbox"
                                    }
                                    name={
                                        draft.type === "multiple_choice_single"
                                            ? "correct-choice"
                                            : undefined
                                    }
                                    checked={option.correct}
                                    onChange={(event) => {
                                        if (draft.type === "multiple_choice_single")
                                            setDraft({
                                                ...draft,
                                                options: draft.options.map((item) => ({
                                                    ...item,
                                                    correct: item.id === option.id,
                                                })),
                                            });
                                        else
                                            updateOption(option.id, {
                                                correct: event.target.checked,
                                            });
                                    }}
                                />{" "}
                                Correct
                            </label>
                            <button
                                type="button"
                                className="secondary"
                                disabled={draft.options.length <= 2}
                                onClick={() =>
                                    setDraft({
                                        ...draft,
                                        options: draft.options.filter(
                                            (item) => item.id !== option.id,
                                        ),
                                    })
                                }
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                    <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                            setDraft({
                                ...draft,
                                options: [
                                    ...draft.options,
                                    { id: crypto.randomUUID(), text: "", correct: false },
                                ],
                            })
                        }
                    >
                        Add choice
                    </button>
                </fieldset>
            )}
            <label>
                Explanation <span className="muted">(optional)</span>
                <textarea
                    rows={3}
                    value={draft.explanation}
                    onChange={(event) => setDraft({ ...draft, explanation: event.target.value })}
                />
            </label>
            {error ? (
                <p role="alert" className="error-text">
                    {error}
                </p>
            ) : null}
            <button type="submit" disabled={busy}>
                {busy ? "Saving…" : submitLabel}
            </button>
        </form>
    );
}
