import type { QuizDetail } from "@quiz-builder/contracts";

import styles from "../pages/quiz-detail-page.module.css";

export function QuizOverview({ quiz }: { quiz: QuizDetail }) {
    return (
        <div className="page-stack">
            <section className="panel">
                <h2>Quiz overview</h2>
                <p className="muted">
                    {quiz.description ||
                        "Select a question on the left to view its content and answers."}
                </p>
                <dl className={styles.stats}>
                    <div>
                        <dt>Questions</dt>
                        <dd>{quiz.questions.length}</dd>
                    </div>
                    <div>
                        <dt>Total points</dt>
                        <dd>{quiz.questions.reduce((sum, item) => sum + item.points, 0)}</dd>
                    </div>
                    <div>
                        <dt>Required</dt>
                        <dd>{quiz.questions.filter((item) => item.required).length}</dd>
                    </div>
                </dl>
                <p className="muted small">
                    {quiz.settings.shuffleQuestions
                        ? "Shuffled question order"
                        : "Fixed question order"}{" "}
                    ·{" "}
                    {quiz.settings.showAnswersAfterCompletion
                        ? "Answers shown after completion"
                        : "Answers hidden after completion"}
                </p>
            </section>
            {!quiz.canEditContent ? (
                <p className="message-panel">
                    {quiz.isOwner
                        ? "This quiz has attempts and is read-only. Changes require a new quiz."
                        : "This public quiz is read-only."}
                </p>
            ) : null}
        </div>
    );
}
