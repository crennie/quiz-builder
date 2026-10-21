import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { getQuiz, saveQuizContent } from "../api/quizzes";
import { useAuth } from "../auth/auth-state";
import { useState } from "react";
import { QuizQuestionList } from "../components/quiz-question-list";
import { QuizOverview } from "../components/quiz-overview";
import { QuizStartPanel } from "../components/quiz-start-panel";
import { QuizEditor } from "../components/quiz-editor";
import { ContentTags } from "../components/content-tags";
import { FeedbackForm } from "../components/feedback-form";
import { QuizQuestionSettings } from "../components/quiz-question-settings";
import { QuizAddQuestion } from "../components/quiz-add-question";
import { QuizQuestionPreview } from "../components/quiz-question-preview";
import styles from "./quiz-detail-page.module.css";
import type { QuizContent } from "@quiz-builder/contracts";
export function QuizDetailPage() {
    const { quizId } = useParams({ from: "/quizzes/$quizId" });
    const { session } = useAuth();
    const client = useQueryClient();
    const [addingBusy, setAddingBusy] = useState(false);
    const [adding, setAdding] = useState(false);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const query = useQuery({
        queryKey: ["quiz", session?.user.id, quizId],
        queryFn: () => getQuiz(quizId),
    });
    const save = useMutation({
        mutationFn: (content: QuizContent) => saveQuizContent(quizId, content),
        onSuccess: async (updated) => {
            const previousIndex =
                query.data?.questions.findIndex((item) => item.id === selectedId) ?? -1;
            setSelectedId(updated.questions[previousIndex]?.id ?? null);
            client.setQueryData(["quiz", session?.user.id, quizId], updated);
            await client.invalidateQueries({ queryKey: ["quizzes"] });
            await client.invalidateQueries({ queryKey: ["questions"] });
            await client.invalidateQueries({ queryKey: ["question"] });
        },
    });
    if (query.isPending) return <p role="status">Loading quiz…</p>;
    if (query.isError)
        return (
            <div role="alert">
                <h1>Quiz unavailable</h1>
                <p>{query.error.message}</p>
                <Link to="/quizzes">Quizzes</Link>
            </div>
        );
    const q = query.data;
    function content(questions: QuizContent["questions"]): QuizContent {
        return { title: q.title, description: q.description, settings: q.settings, questions };
    }
    const memberships = q.questions.map(({ questionId, points, required, timeLimitSeconds }) => ({
        questionId,
        points,
        required,
        timeLimitSeconds,
    }));
    const selected = q.questions.find((item) => item.id === selectedId);
    return (
        <div className="page-stack">
            <Link to="/quizzes">← My Quizzes</Link>
            <header className="page-heading">
                <div className="detail-title">
                    <h1>{q.title}</h1>
                    {q.isOwner ? (
                        <ContentTags id={q.id} kind="quiz" tags={q.tags} compact />
                    ) : q.tags.length ? (
                        <div className="tag-row">
                            {q.tags.map((tag) => (
                                <span className="tag" key={tag.id}>
                                    {tag.name}
                                </span>
                            ))}
                        </div>
                    ) : null}
                </div>
            </header>
            <QuizOverview quiz={q} />
            <div className={styles.layout}>
                <aside
                    className={`panel ${styles.sidebar}`}
                    aria-labelledby="quiz-questions-heading"
                >
                    <QuizQuestionList
                        quiz={q}
                        selectedId={adding ? "adding" : (selected?.id ?? null)}
                        onSelect={(id) => {
                            setAdding(false);
                            setSelectedId(id);
                        }}
                        onAdd={() => {
                            setAdding(true);
                            setSelectedId(null);
                        }}
                        disabled={save.isPending || addingBusy}
                    />
                </aside>
                <div className={styles.workspace}>
                    {adding && q.canEditContent ? (
                        <QuizAddQuestion
                            onBusyChange={setAddingBusy}
                            onClose={() => setAdding(false)}
                            onAdd={async (question) => {
                                const updated = await save.mutateAsync(
                                    content([...memberships, question]),
                                );
                                setSelectedId(updated.questions.at(-1)?.id ?? null);
                                setAdding(false);
                            }}
                        />
                    ) : selected ? (
                        <div className="page-stack">
                            <section className="panel">
                                <h2>Question {q.questions.indexOf(selected) + 1}</h2>
                                <p className="muted small">
                                    Question content and answers are locked. To change them, add a
                                    new question.
                                </p>
                                <QuizQuestionPreview question={selected.question} />
                                <p className="muted small">
                                    {selected.points} points ·{" "}
                                    {selected.required ? "Required" : "Optional"} ·{" "}
                                    {selected.timeLimitSeconds === null
                                        ? "No time limit"
                                        : `${selected.timeLimitSeconds} seconds`}
                                </p>
                            </section>
                            {q.canEditContent ? (
                                <QuizQuestionSettings
                                    key={selected.id}
                                    item={selected}
                                    busy={save.isPending}
                                    onSave={async (value) => {
                                        await save.mutateAsync(
                                            content(
                                                memberships.map((item, index) =>
                                                    q.questions[index]?.id === selected.id
                                                        ? value
                                                        : item,
                                                ),
                                            ),
                                        );
                                    }}
                                    onRemove={async () => {
                                        await save.mutateAsync(
                                            content(
                                                memberships.filter(
                                                    (_, index) =>
                                                        q.questions[index]?.id !== selected.id,
                                                ),
                                            ),
                                        );
                                        setSelectedId(null);
                                    }}
                                />
                            ) : (
                                <p className="message-panel">
                                    This quiz is read-only. Questions cannot be added, removed, or
                                    reconfigured.
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="page-stack">
                            <QuizStartPanel quiz={q} />
                            {q.canEditContent ? (
                                <section className="panel">
                                    <h2>Quiz settings</h2>
                                    <QuizEditor
                                        key={q.updatedAt}
                                        initial={q}
                                        manageQuestions={false}
                                        busy={save.isPending}
                                        submitLabel="Save quiz"
                                        onSave={async (content) => {
                                            await save.mutateAsync(content);
                                        }}
                                    />
                                </section>
                            ) : null}
                            <FeedbackForm target={{ quizId: q.id }} />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
