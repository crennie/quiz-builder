import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { QuizContent, Visibility } from "@quiz-builder/contracts";

import { createQuiz } from "../api/quizzes";
import { QuizEditor } from "../components/quiz-editor";

export function NewQuizPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [visibility, setVisibility] = useState<Visibility>("private");
    const [status, setStatus] = useState<"draft" | "published">("draft");
    const mutation = useMutation({ mutationFn: createQuiz });

    async function save(content: QuizContent) {
        const quiz = await mutation.mutateAsync({ content, visibility, status });
        await queryClient.invalidateQueries({ queryKey: ["quizzes"] });
        await navigate({ to: "/quizzes/$quizId", params: { quizId: quiz.id } });
    }

    return (
        <div className="page-stack narrow">
            <Link to="/quizzes">← Quizzes</Link>
            <div>
                <p className="eyebrow">Create</p>
                <h1>New quiz</h1>
                <p className="muted">
                    Add questions and settings, then save the first quiz version.
                </p>
            </div>
            <section className="panel form-grid">
                <h2>Access and lifecycle</h2>
                <label>
                    Visibility
                    <select
                        value={visibility}
                        onChange={(event) => setVisibility(event.target.value as Visibility)}
                    >
                        <option value="private">Private</option>
                        <option value="unlisted">Unlisted</option>
                        <option value="public">Public</option>
                    </select>
                </label>
                <label>
                    Status
                    <select
                        value={status}
                        onChange={(event) => setStatus(event.target.value as "draft" | "published")}
                    >
                        <option value="draft">Draft</option>
                        <option value="published">Published</option>
                    </select>
                </label>
                <p className="muted small">Published quizzes need at least one question.</p>
            </section>
            <section className="panel">
                <QuizEditor submitLabel="Create quiz" busy={mutation.isPending} onSave={save} />
            </section>
        </div>
    );
}
