import type { QuestionContent } from "@quiz-builder/contracts";

export function QuizQuestionPreview({ question }: { question: QuestionContent }) {
    const answer = question.answerConfig;
    return (
        <div className="page-stack">
            <p>{question.prompt}</p>
            <p className="muted">{question.questionType.replaceAll("_", " ")}</p>
            <section>
                <h3>
                    {answer.questionType === "exact_text" ? "Accepted answers" : "Answer choices"}
                </h3>
                {answer.questionType === "exact_text" ? (
                    <ul>
                        {answer.acceptedAnswers.map((text, index) => (
                            <li key={index}>{text}</li>
                        ))}
                    </ul>
                ) : (
                    <ol>
                        {answer.options.map((option) => {
                            const correct =
                                answer.questionType === "multiple_choice_single"
                                    ? answer.correctOptionId === option.id
                                    : answer.correctOptionIds.includes(option.id);
                            return (
                                <li key={option.id}>
                                    {option.text}
                                    {correct ? " · Correct" : ""}
                                </li>
                            );
                        })}
                    </ol>
                )}
                {question.gradingConfig.questionType === "exact_text" ? (
                    <p className="muted">
                        {question.gradingConfig.caseSensitive
                            ? "Case sensitive"
                            : "Case insensitive"}{" "}
                        ·{" "}
                        {question.gradingConfig.trimWhitespace
                            ? "Leading and trailing spaces ignored"
                            : "Spaces must match"}
                    </p>
                ) : null}
            </section>
            <section>
                <h3>Explanation</h3>
                <p>{question.explanation || "No explanation provided."}</p>
            </section>
        </div>
    );
}
