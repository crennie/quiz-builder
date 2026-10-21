import { useState, type FormEvent } from "react";
import {
    quizQuestionInputSchema,
    type QuizContent,
    type QuizDetail,
} from "@quiz-builder/contracts";

type Membership = QuizDetail["questions"][number];

export function QuizQuestionSettings({
    item,
    busy,
    onSave,
    onRemove,
}: {
    item: Membership;
    busy: boolean;
    onSave: (value: QuizContent["questions"][number]) => Promise<void>;
    onRemove: () => Promise<void>;
}) {
    const [points, setPoints] = useState(String(item.points));
    const [timeLimit, setTimeLimit] = useState(
        item.timeLimitSeconds === null ? "" : String(item.timeLimitSeconds),
    );
    const [required, setRequired] = useState(item.required);
    const [message, setMessage] = useState("");
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        const parsed = quizQuestionInputSchema.safeParse({
            questionId: item.questionId,
            points: Number(points),
            required,
            timeLimitSeconds: timeLimit === "" ? null : Number(timeLimit),
        });
        if (!parsed.success) {
            setMessage("Enter valid points and a whole-number time limit greater than zero.");
            return;
        }
        try {
            await onSave(parsed.data);
            setMessage("Quiz question settings saved.");
        } catch (error) {
            setMessage(error instanceof Error ? error.message : "Could not save settings.");
        }
    }
    return (
        <section className="panel">
            <h2>Settings in this quiz</h2>
            <form className="form-grid" onSubmit={(event) => void submit(event)}>
                <fieldset className="quiz-fieldset" disabled={busy}>
                    <legend>Question settings</legend>
                    <label>
                        Points
                        <input
                            type="number"
                            min="0"
                            step="any"
                            required
                            value={points}
                            onChange={(event) => setPoints(event.target.value)}
                        />
                    </label>
                    <label>
                        Time limit in seconds
                        <input
                            type="number"
                            min="1"
                            step="1"
                            placeholder="No limit"
                            value={timeLimit}
                            onChange={(event) => setTimeLimit(event.target.value)}
                        />
                    </label>
                    <label className="checkbox-row">
                        <input
                            type="checkbox"
                            checked={required}
                            onChange={(event) => setRequired(event.target.checked)}
                        />
                        Required
                    </label>
                </fieldset>
                <button type="submit" disabled={busy}>
                    {busy ? "Saving…" : "Save settings"}
                </button>
                <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => {
                        void onRemove().catch((error: unknown) =>
                            setMessage(
                                error instanceof Error
                                    ? error.message
                                    : "Could not remove question.",
                            ),
                        );
                    }}
                >
                    Remove from quiz
                </button>
                <p className="muted small">
                    Removing a question keeps its original content in your question library.
                </p>
                {message ? <p role="status">{message}</p> : null}
            </form>
        </section>
    );
}
