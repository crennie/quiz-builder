import type { QuizDetail } from "@quiz-builder/contracts";

export function QuizQuestionList({
    quiz,
    selectedId,
    onSelect,
    disabled,
    onAdd,
}: {
    quiz: QuizDetail;
    selectedId: string | null;
    onSelect: (id: string | null) => void;
    disabled: boolean;
    onAdd: () => void;
}) {
    return (
        <>
            <button
                type="button"
                aria-pressed={selectedId === null}
                disabled={disabled}
                onClick={() => onSelect(null)}
            >
                Attempts
            </button>
            <h2 id="quiz-questions-heading">Questions</h2>
            {quiz.questions.length ? (
                <ol>
                    {quiz.questions.map((item, index) => (
                        <li key={item.id}>
                            <button
                                type="button"
                                aria-pressed={selectedId === item.id}
                                disabled={disabled}
                                onClick={() => onSelect(item.id)}
                            >
                                <span className="muted small">Question {index + 1}</span>
                                <span>{item.question.prompt}</span>
                                <span className="muted small">
                                    {item.points} points · {item.required ? "Required" : "Optional"}
                                </span>
                            </button>
                        </li>
                    ))}
                </ol>
            ) : (
                <p className="muted">No questions yet.</p>
            )}
            {quiz.canEditContent ? (
                <button type="button" disabled={disabled} onClick={onAdd}>
                    Add question
                </button>
            ) : null}
        </>
    );
}
