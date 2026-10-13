import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import type { QuestionContent } from "@quiz-builder/contracts";

import { createQuestion } from "../api/questions";
import { QuestionEditor } from "../components/question-editor";

export function NewQuestionPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const mutation = useMutation({ mutationFn: createQuestion });

    async function save(content: QuestionContent) {
        const question = await mutation.mutateAsync({ content });
        await queryClient.invalidateQueries({ queryKey: ["questions"] });
        void navigate({ to: "/questions/$questionId", params: { questionId: question.id } });
    }

    return (
        <div className="page-stack narrow">
            <Link to="/questions/mine">← My questions</Link>
            <div>
                <p className="eyebrow">Create</p>
                <h1>New question</h1>
                <p className="muted">Choose an answer format and save a private question.</p>
            </div>
            <section className="panel">
                <QuestionEditor
                    submitLabel="Create question"
                    busy={mutation.isPending}
                    onSave={save}
                />
            </section>
        </div>
    );
}
