import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { getQuestion, saveQuestionContent } from "../api/questions";
import { useAuth } from "../auth/auth-state";
import { QuestionEditor } from "../components/question-editor";
import { ContentTags } from "../components/content-tags";
import { FeedbackForm } from "../components/feedback-form";
import type { QuestionContent } from "@quiz-builder/contracts";
export function QuestionDetailPage() {
    const { questionId } = useParams({ from: "/questions/$questionId" });
    const { session } = useAuth();
    const client = useQueryClient();
    const query = useQuery({
        queryKey: ["question", session?.user.id, questionId],
        queryFn: () => getQuestion(questionId),
    });
    const save = useMutation({
        mutationFn: (content: QuestionContent) => saveQuestionContent(questionId, content),
        onSuccess: async () => {
            await client.invalidateQueries({
                queryKey: ["question", session?.user.id, questionId],
            });
            await client.invalidateQueries({ queryKey: ["questions"] });
        },
    });
    if (query.isPending) return <p role="status">Loading question…</p>;
    if (query.isError)
        return (
            <div role="alert">
                <h1>Question unavailable</h1>
                <p>{query.error.message}</p>
                <Link to="/questions/mine">My questions</Link>
            </div>
        );
    const q = query.data;
    const answer = q.answerConfig;
    return (
        <div className="page-stack narrow">
            <Link to="/questions/mine">← My questions</Link>
            <header className="detail-title">
                <h1>{q.prompt}</h1>
                {q.isOwner ? (
                    <ContentTags id={q.id} kind="question" tags={q.tags} compact />
                ) : q.tags.length ? (
                    <div className="tag-row">
                        {q.tags.map((tag) => (
                            <span className="tag" key={tag.id}>
                                {tag.name}
                            </span>
                        ))}
                    </div>
                ) : null}
            </header>
            <p>
                {q.questionType.replaceAll("_", " ")} · {q.visibility}
            </p>
            <section className="panel">
                <h2>Question content</h2>
                {answer.questionType === "exact_text" ? (
                    <>
                        <h3>Accepted answers</h3>
                        <ul>
                            {answer.acceptedAnswers.map((text, index) => (
                                <li key={index}>{text}</li>
                            ))}
                        </ul>
                    </>
                ) : (
                    <>
                        <h3>Choices</h3>
                        <ol>
                            {answer.options.map((option) => {
                                const correct =
                                    answer.questionType === "multiple_choice_single"
                                        ? answer.correctOptionId === option.id
                                        : answer.correctOptionIds.includes(option.id);
                                return (
                                    <li key={option.id}>
                                        {option.text}
                                        {correct ? " · Correct" : null}
                                    </li>
                                );
                            })}
                        </ol>
                    </>
                )}
                {q.gradingConfig.questionType === "exact_text" ? (
                    <p className="muted">
                        {q.gradingConfig.caseSensitive ? "Case sensitive" : "Case insensitive"} ·{" "}
                        {q.gradingConfig.trimWhitespace
                            ? "Leading and trailing spaces ignored"
                            : "Spaces must match"}
                    </p>
                ) : null}
                <p>{q.explanation}</p>
            </section>
            {q.canEditContent ? (
                <section className="panel">
                    <h2>Edit question</h2>
                    <QuestionEditor
                        key={q.updatedAt}
                        initial={q}
                        busy={save.isPending}
                        submitLabel="Save question"
                        onSave={async (c) => {
                            await save.mutateAsync(c);
                        }}
                    />
                </section>
            ) : (
                <section className="panel">
                    <p>
                        {q.contentLockedAt
                            ? "This question has been used in a quiz and is permanently locked. Create a new question to make changes."
                            : "Public question content is read-only."}
                    </p>
                    {q.isOwner ? <Link to="/questions/new">New question</Link> : null}
                </section>
            )}
            <FeedbackForm target={{ questionId: q.id }} />
        </div>
    );
}
