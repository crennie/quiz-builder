import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { createTag, listManagedQuestions, listTags } from "../api/questions";
import { useAuth } from "../auth/auth-state";
export function QuestionBankPage() {
    const { session } = useAuth();
    const client = useQueryClient();
    const [tag, setTag] = useState("");
    const [offset, setOffset] = useState(0);
    const [search, setSearch] = useState("");
    const [newTag, setNewTag] = useState("");
    const questions = useQuery({
        queryKey: ["questions", "mine", session?.user.id, tag, offset],
        queryFn: () => listManagedQuestions({ ...(tag ? { tag } : {}), offset }),
    });
    const tags = useQuery({ queryKey: ["tags", session?.user.id], queryFn: listTags });
    const addTag = useMutation({
        mutationFn: createTag,
        onSuccess: () => {
            setNewTag("");
            void client.invalidateQueries({ queryKey: ["tags"] });
        },
    });
    function submitTag(e: FormEvent) {
        e.preventDefault();
        if (newTag.trim()) addTag.mutate(newTag.trim());
    }
    const items =
        questions.data?.items.filter((q) =>
            q.prompt.toLowerCase().includes(search.toLowerCase()),
        ) ?? [];
    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <p className="eyebrow">Personal library</p>
                    <h1>My questions</h1>
                    <p className="muted">
                        Edit unused questions. Used questions stay locked to protect quizzes.
                    </p>
                </div>
                <Link className="button" to="/questions/new">
                    New question
                </Link>
                <Link to="/questions/batches">Import question batch</Link>
            </div>
            <section className="panel" aria-label="Question filters">
                <div className="filter-grid">
                    <label>
                        Search prompts
                        <input
                            type="search"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search this page"
                        />
                    </label>
                    <label>
                        Tag
                        <select
                            value={tag}
                            onChange={(e) => {
                                setTag(e.target.value);
                                setOffset(0);
                            }}
                        >
                            <option value="">All tags</option>
                            {tags.data?.map((t) => (
                                <option key={t.id} value={t.slug}>
                                    {t.name}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                <p className="muted small">Prompt search applies to this page of results.</p>
            </section>
            <section className="panel" aria-label="Your tags">
                <h2>Tags</h2>
                <form className="inline-form" onSubmit={submitTag}>
                    <label>
                        New tag
                        <input
                            value={newTag}
                            maxLength={100}
                            onChange={(e) => setNewTag(e.target.value)}
                        />
                    </label>
                    <button type="submit" disabled={addTag.isPending}>
                        Add tag
                    </button>
                </form>
                {addTag.isError ? <p role="alert">{addTag.error.message}</p> : null}
                {tags.isError ? <p role="alert">{tags.error.message}</p> : null}
                <p className="tag-row">
                    {tags.data?.map((t) => (
                        <span className="tag" key={t.id}>
                            {t.name}
                        </span>
                    ))}
                </p>
            </section>
            {questions.isPending ? <p role="status">Loading questions…</p> : null}
            {questions.isError ? (
                <div role="alert">
                    <p>Could not load questions. {questions.error.message}</p>
                    <button type="button" onClick={() => void questions.refetch()}>
                        Try again
                    </button>
                </div>
            ) : null}
            {questions.data ? (
                <section aria-label="Questions">
                    <h2>Questions</h2>
                    {items.length ? (
                        <ul className="card-list">
                            {items.map((q) => (
                                <li className="question-card" key={q.id}>
                                    <Link
                                        className="question-link"
                                        to="/questions/$questionId"
                                        params={{ questionId: q.id }}
                                    >
                                        {q.prompt}
                                    </Link>
                                    <p className="muted small">
                                        {q.questionType.replaceAll("_", " ")} · {q.visibility} ·{" "}
                                        {q.contentLockedAt ? "Locked" : "Unused"}
                                    </p>
                                    <div className="tag-row">
                                        {q.tags.map((t) => (
                                            <span className="tag" key={t.id}>
                                                {t.name}
                                            </span>
                                        ))}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p>No questions match these filters.</p>
                    )}
                    <div className="pagination">
                        <button
                            type="button"
                            disabled={offset === 0}
                            onClick={() => setOffset(Math.max(0, offset - 50))}
                        >
                            Previous
                        </button>
                        <span>Page {Math.floor(offset / 50) + 1}</span>
                        <button
                            type="button"
                            disabled={questions.data.nextOffset === null}
                            onClick={() => setOffset(questions.data.nextOffset ?? offset)}
                        >
                            Next
                        </button>
                    </div>
                </section>
            ) : null}
        </div>
    );
}
