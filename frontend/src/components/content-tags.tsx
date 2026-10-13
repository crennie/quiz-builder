import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { Tag } from "@quiz-builder/contracts";
import { listTags, assignQuestionTag, removeQuestionTag } from "../api/questions";
import { assignQuizTag, removeQuizTag } from "../api/quizzes";
import { useAuth } from "../auth/auth-state";
export function ContentTags({
    id,
    kind,
    tags,
}: {
    id: string;
    kind: "question" | "quiz";
    tags: Tag[];
}) {
    const { session } = useAuth();
    const client = useQueryClient();
    const [selected, setSelected] = useState("");
    const available = useQuery({ queryKey: ["tags", session?.user.id], queryFn: listTags });
    const mutation = useMutation({
        mutationFn: async ({ tagId, remove }: { tagId: string; remove: boolean }) => {
            if (kind === "question") {
                if (remove) await removeQuestionTag(id, tagId);
                else await assignQuestionTag(id, tagId);
            } else {
                if (remove) await removeQuizTag(id, tagId);
                else await assignQuizTag(id, tagId);
            }
        },
        onSuccess: async () => {
            setSelected("");
            await client.invalidateQueries({ queryKey: [kind, session?.user.id, id] });
            await client.invalidateQueries({
                queryKey: [kind === "question" ? "questions" : "quizzes"],
            });
        },
    });
    return (
        <section className="panel">
            <h2>Tags</h2>
            <div className="tag-row">
                {tags.map((t) => (
                    <button
                        key={t.id}
                        type="button"
                        disabled={mutation.isPending}
                        aria-label={`Remove ${t.name} tag`}
                        onClick={() => mutation.mutate({ tagId: t.id, remove: true })}
                    >
                        {t.name} ×
                    </button>
                ))}
            </div>
            <label>
                Tag to add
                <select value={selected} onChange={(e) => setSelected(e.target.value)}>
                    <option value="">Choose a tag</option>
                    {available.data
                        ?.filter((t) => !tags.some((a) => a.id === t.id))
                        .map((t) => (
                            <option key={t.id} value={t.id}>
                                {t.name}
                            </option>
                        ))}
                </select>
            </label>
            <button
                type="button"
                disabled={!selected || mutation.isPending}
                onClick={() => mutation.mutate({ tagId: selected, remove: false })}
            >
                Add tag
            </button>
            {available.isError ? <p role="alert">{available.error.message}</p> : null}
            {mutation.isError ? <p role="alert">{mutation.error.message}</p> : null}
        </section>
    );
}
