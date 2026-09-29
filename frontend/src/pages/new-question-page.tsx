import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import type { QuestionVersionContent, Visibility } from "@quiz-builder/contracts";

import { createQuestion } from "../api/questions";
import { QuestionEditor } from "../components/question-editor";

export function NewQuestionPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [visibility, setVisibility] = useState<Visibility>("private");
    const [status, setStatus] = useState<"draft" | "published">("draft");
    const mutation = useMutation({ mutationFn: createQuestion });

    async function save(content: QuestionVersionContent) {
        const question = await mutation.mutateAsync({ content, visibility, status });
        await queryClient.invalidateQueries({ queryKey: ["questions"] });
        void navigate({ to: "/questions/$questionId", params: { questionId: question.id } });
    }

    return (
        <div className="page-stack narrow">
            <Link to="/questions">← Question bank</Link>
            <div>
                <p className="eyebrow">Create</p>
                <h1>New question</h1>
                <p className="muted">Choose an answer format and save the first version.</p>
            </div>
            <section className="panel">
                <QuestionEditor
                    submitLabel="Create question"
                    busy={mutation.isPending}
                    onSave={save}
                />
            </section>
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
            </section>
        </div>
    );
}
