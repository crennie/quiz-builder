import { useState } from "react";
import type { QuestionContent, QuizContent } from "@quiz-builder/contracts";

import { createQuestion } from "../api/questions";
import { QuestionEditor } from "./question-editor";
import { QuestionPicker } from "./quiz-editor";

export function QuizAddQuestion({
    onAdd,
    onClose,
    onBusyChange,
}: {
    onAdd: (question: QuizContent["questions"][number]) => Promise<void>;
    onClose: () => void;
    onBusyChange: (busy: boolean) => void;
}) {
    const [mode, setMode] = useState<"existing" | "new">("existing");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [createdId, setCreatedId] = useState<string | null>(null);

    async function addExisting(question: QuizContent["questions"][number]) {
        setBusy(true);
        onBusyChange(true);
        setError("");
        try {
            await onAdd(question);
        } catch (error) {
            setError(error instanceof Error ? error.message : "Could not add question.");
        } finally {
            setBusy(false);
            onBusyChange(false);
        }
    }
    async function addNew(content: QuestionContent) {
        setError("");
        setBusy(true);
        onBusyChange(true);
        try {
            const question = await createQuestion({ content });
            setCreatedId(question.id);
            await onAdd({
                questionId: question.id,
                points: 1,
                required: true,
                timeLimitSeconds: null,
            });
        } catch (error) {
            setError(error instanceof Error ? error.message : "Could not create and add question.");
        } finally {
            setBusy(false);
            onBusyChange(false);
        }
    }
    return (
        <section className="panel">
            <h2>Add question</h2>
            <p className="muted">Question content locks when added to a quiz.</p>
            <fieldset className="quiz-fieldset" disabled={busy}>
                <legend>Choose or create</legend>
                <div className="quiz-actions">
                    <button
                        type="button"
                        className="secondary"
                        aria-pressed={mode === "existing"}
                        onClick={() => setMode("existing")}
                    >
                        Existing question
                    </button>
                    <button
                        type="button"
                        className="secondary"
                        aria-pressed={mode === "new"}
                        onClick={() => setMode("new")}
                    >
                        New question
                    </button>
                    <button type="button" className="secondary" onClick={onClose}>
                        Cancel
                    </button>
                </div>
                {mode === "existing" ? (
                    <QuestionPicker
                        onClose={onClose}
                        onSelect={(question) =>
                            void addExisting({
                                questionId: question.questionId,
                                points: question.points,
                                required: question.required,
                                timeLimitSeconds: question.timeLimitSeconds,
                            })
                        }
                    />
                ) : createdId ? (
                    <div className="message-panel">
                        <p>
                            The new question was saved to your library, but has not been added to
                            this quiz yet.
                        </p>
                        <button
                            type="button"
                            onClick={() =>
                                void addExisting({
                                    questionId: createdId,
                                    points: 1,
                                    required: true,
                                    timeLimitSeconds: null,
                                })
                            }
                        >
                            Retry adding question
                        </button>
                    </div>
                ) : (
                    <QuestionEditor
                        busy={busy}
                        submitLabel="Create and add question"
                        onSave={addNew}
                    />
                )}
            </fieldset>
            {error ? <p role="alert">{error}</p> : null}
        </section>
    );
}
