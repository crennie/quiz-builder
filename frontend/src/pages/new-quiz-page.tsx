import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { QuizContent } from "@quiz-builder/contracts";

import { createQuiz } from "../api/quizzes";
import { QuizEditor } from "../components/quiz-editor";

export function NewQuizPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const mutation = useMutation({ mutationFn: createQuiz });

    async function save(content: QuizContent) {
        const quiz = await mutation.mutateAsync({ content });
        await queryClient.invalidateQueries({ queryKey: ["quizzes"] });
        await queryClient.invalidateQueries({ queryKey: ["questions"] });
        await queryClient.invalidateQueries({ queryKey: ["question"] });
        await navigate({ to: "/quizzes/$quizId", params: { quizId: quiz.id } });
    }

    return (
        <div className="page-stack narrow">
            <Link to="/quizzes">← Quizzes</Link>
            <div>
                <p className="eyebrow">Create</p>
                <h1>New quiz</h1>
                <p className="muted">Add questions and settings, then save your private quiz.</p>
            </div>
            <section className="panel">
                <QuizEditor submitLabel="Create quiz" busy={mutation.isPending} onSave={save} />
            </section>
        </div>
    );
}
