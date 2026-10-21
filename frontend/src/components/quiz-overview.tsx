import type { QuizContent, QuizDetail } from "@quiz-builder/contracts";

import { QuizEditor } from "./quiz-editor";
import { QuizStartPanel } from "./quiz-start-panel";
import { ContentTags } from "./content-tags";
import { FeedbackForm } from "./feedback-form";
import styles from "../pages/quiz-detail-page.module.css";

export function QuizOverview({
    quiz,
    busy,
    onSave,
}: {
    quiz: QuizDetail;
    busy: boolean;
    onSave: (content: QuizContent) => Promise<void>;
}) {
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
            {quiz.canEditContent ? (
                <section className="panel">
                    <h2>Quiz settings</h2>
                    <QuizEditor
                        key={quiz.updatedAt}
                        initial={quiz}
                        manageQuestions={false}
                        busy={busy}
                        submitLabel="Save quiz"
                        onSave={onSave}
                    />
                </section>
            ) : (
                <section className="message-panel">
                    <p>
                        {quiz.isOwner
                            ? "This quiz has attempts and is read-only. Changes require a new quiz."
                            : "This public quiz is read-only."}
                    </p>
                </section>
            )}
            <QuizStartPanel quiz={quiz} />
            {quiz.isOwner ? <ContentTags id={quiz.id} kind="quiz" tags={quiz.tags} /> : null}
            <FeedbackForm target={{ quizId: quiz.id }} />
        </div>
    );
}
