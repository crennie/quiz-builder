import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { getQuiz, saveQuizContent } from "../api/quizzes";
import { useAuth } from "../auth/auth-state";
import { QuizEditor } from "../components/quiz-editor";
import { QuizStartPanel } from "../components/quiz-start-panel";
import { ContentTags } from "../components/content-tags";
import { FeedbackForm } from "../components/feedback-form";
import type { QuizContent } from "@quiz-builder/contracts";
export function QuizDetailPage() {
    const { quizId } = useParams({ from: "/quizzes/$quizId" });
    const { session } = useAuth();
    const client = useQueryClient();
    const query = useQuery({
        queryKey: ["quiz", session?.user.id, quizId],
        queryFn: () => getQuiz(quizId),
    });
    const save = useMutation({
        mutationFn: (content: QuizContent) => saveQuizContent(quizId, content),
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: ["quiz", session?.user.id, quizId] });
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
    return (
        <div className="page-stack narrow">
            <Link to="/quizzes">← Quizzes</Link>
            <h1>{q.title}</h1>
            <p>
                {q.questions.length} questions · {q.visibility}
            </p>
            <QuizStartPanel quiz={q} />
            {q.isOwner ? <ContentTags id={q.id} kind="quiz" tags={q.tags} /> : null}
            {q.canEditContent ? (
                <section className="panel">
                    <h2>Edit quiz content</h2>
                    <QuizEditor
                        key={q.updatedAt}
                        initial={q}
                        busy={save.isPending}
                        submitLabel="Save quiz"
                        onSave={async (c) => {
                            await save.mutateAsync(c);
                        }}
                    />
                </section>
            ) : (
                <section className="panel">
                    <h2>Quiz content</h2>
                    <p>{q.description}</p>
                    <ol>
                        {q.questions.map((m) => (
                            <li key={m.id}>{m.question.prompt}</li>
                        ))}
                    </ol>
                    <p>
                        {q.isOwner
                            ? "This quiz is read-only. After an attempt, changes require a new quiz record."
                            : "Public quiz content is read-only."}
                    </p>
                    {q.isOwner ? <Link to="/quizzes/new">New quiz</Link> : null}
                </section>
            )}
            <FeedbackForm target={{ quizId: q.id }} />
        </div>
    );
}
