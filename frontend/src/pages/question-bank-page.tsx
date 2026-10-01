import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import type { BankQuestionDetail, QuestionDetail } from "@quiz-builder/contracts";

import { createTag, listManagedQuestions, listQuestions, listTags } from "../api/questions";
import { useAuth } from "../auth/auth-state";

function displayVersion(question: BankQuestionDetail | QuestionDetail) {
    return "publishedVersion" in question ? question.publishedVersion : question.currentVersion;
}

export function QuestionBankPage({ mine = false }: { mine?: boolean }) {
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const [tag, setTag] = useState("");
    const [offset, setOffset] = useState(0);
    const [search, setSearch] = useState("");
    const [visibility, setVisibility] = useState("");
    const [status, setStatus] = useState("");
    const [newTag, setNewTag] = useState("");
    const questions = useQuery<{
        items: Array<BankQuestionDetail | QuestionDetail>;
        nextOffset: number | null;
    }>({
        queryKey: ["questions", mine ? "mine" : "bank", session?.user.id, tag, offset],
        queryFn: () =>
            (mine ? listManagedQuestions : listQuestions)({ ...(tag ? { tag } : {}), offset }),
    });
    const tags = useQuery({ queryKey: ["tags", session?.user.id], queryFn: listTags });
    const addTag = useMutation({
        mutationFn: createTag,
        onSuccess: () => {
            setNewTag("");
            void queryClient.invalidateQueries({ queryKey: ["tags"] });
        },
    });
    const filtered =
        questions.data?.items.filter(
            (question) =>
                (!search ||
                    displayVersion(question).prompt.toLowerCase().includes(search.toLowerCase())) &&
                (!visibility || question.visibility === visibility) &&
                (!status || question.status === status),
        ) ?? [];

    function submitTag(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (newTag.trim()) addTag.mutate(newTag.trim());
    }

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <p className="eyebrow">{mine ? "Manage" : "Question bank"}</p>
                    <h1>{mine ? "My questions" : "Published questions"}</h1>
                    <p className="muted">
                        Create reusable prompts, then revise them without changing earlier versions.
                    </p>
                </div>
                <Link className="button" to="/questions/new">
                    New question
                </Link>
                <Link to="/questions/agent">Generate with agent</Link>
                <Link to="/questions/batches">Import question batch</Link>
                <Link to={mine ? "/questions" : "/questions/mine"}>
                    {mine ? "Browse question bank" : "My drafts and questions"}
                </Link>
            </div>
            <section className="panel" aria-label="Question filters">
                <div className="filter-grid">
                    <label>
                        Search prompts
                        <input
                            type="search"
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            placeholder="Search this page"
                        />
                    </label>
                    <label>
                        Tag
                        <select
                            value={tag}
                            onChange={(event) => {
                                setTag(event.target.value);
                                setOffset(0);
                            }}
                        >
                            <option value="">All tags</option>
                            {tags.data?.map((item) => (
                                <option value={item.slug} key={item.id}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Visibility
                        <select
                            value={visibility}
                            onChange={(event) => setVisibility(event.target.value)}
                        >
                            <option value="">All</option>
                            <option value="private">Private</option>
                            <option value="unlisted">Unlisted</option>
                            <option value="public">Public</option>
                        </select>
                    </label>
                    <label>
                        Status
                        <select value={status} onChange={(event) => setStatus(event.target.value)}>
                            <option value="">All</option>
                            {mine ? <option value="draft">Draft</option> : null}
                            <option value="published">Published</option>
                            {mine ? <option value="archived">Archived</option> : null}
                        </select>
                    </label>
                </div>
                <p className="muted small">
                    Prompt, visibility, and status filters apply to the current page of results.
                </p>
            </section>
            <section className="panel" aria-label="Your tags">
                <h2>Tags</h2>
                <form className="inline-form" onSubmit={submitTag}>
                    <label className="sr-only" htmlFor="new-tag">
                        New tag
                    </label>
                    <input
                        id="new-tag"
                        value={newTag}
                        onChange={(event) => setNewTag(event.target.value)}
                        placeholder="New tag name"
                        maxLength={100}
                    />
                    <button type="submit" disabled={addTag.isPending}>
                        Add tag
                    </button>
                </form>
                {addTag.isError ? (
                    <p role="alert" className="error-text">
                        {addTag.error.message}
                    </p>
                ) : null}
                {tags.isError ? (
                    <p role="alert" className="error-text">
                        Could not load tags. {tags.error.message}
                    </p>
                ) : null}
                {tags.data?.length ? (
                    <p className="tag-row">
                        {tags.data.map((item) => (
                            <span className="tag" key={item.id}>
                                {item.name}
                            </span>
                        ))}
                    </p>
                ) : null}
            </section>
            {questions.isPending ? <p role="status">Loading questions…</p> : null}
            {questions.isError ? (
                <div className="message-panel" role="alert">
                    <p>Could not load questions. {questions.error.message}</p>
                    <button
                        type="button"
                        onClick={() => {
                            void questions.refetch();
                        }}
                    >
                        Try again
                    </button>
                </div>
            ) : null}
            {questions.isSuccess ? (
                <section aria-label="Questions">
                    <div className="section-heading">
                        <h2>Questions</h2>
                        <span className="muted">{filtered.length} on this page</span>
                    </div>
                    {filtered.length ? (
                        <ul className="card-list">
                            {filtered.map((question) => (
                                <li className="question-card" key={question.id}>
                                    <Link
                                        to={
                                            mine
                                                ? "/questions/mine/$questionId"
                                                : "/questions/$questionId"
                                        }
                                        params={{ questionId: question.id }}
                                        className="question-link"
                                    >
                                        {displayVersion(question).prompt}
                                    </Link>
                                    <p className="muted small">
                                        {displayVersion(question).questionType.replaceAll("_", " ")}{" "}
                                        · Version {displayVersion(question).versionNumber}
                                    </p>
                                    <div className="tag-row">
                                        <span className="tag">{question.status}</span>
                                        <span className="tag">{question.visibility}</span>
                                        {question.tags.map((item) => (
                                            <span className="tag" key={item.id}>
                                                {item.name}
                                            </span>
                                        ))}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="message-panel">
                            <p>No questions match these filters.</p>
                        </div>
                    )}
                    <div className="pagination">
                        <button
                            className="secondary"
                            type="button"
                            disabled={offset === 0}
                            onClick={() => setOffset(Math.max(0, offset - 50))}
                        >
                            Previous
                        </button>
                        <span>Page {Math.floor(offset / 50) + 1}</span>
                        <button
                            className="secondary"
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
