import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { listQuizzes } from "../api/quizzes";
import { listTags } from "../api/questions";
import { useAuth } from "../auth/auth-state";

export function QuizListPage() {
    const { session } = useAuth();
    const [tag, setTag] = useState("");
    const [offset, setOffset] = useState(0);
    const [search, setSearch] = useState("");
    const [scope, setScope] = useState("mine");
    const quizzes = useQuery({
        queryKey: ["quizzes", session?.user.id, tag, offset],
        queryFn: () => listQuizzes({ ...(tag ? { tag } : {}), offset }),
    });
    const tags = useQuery({ queryKey: ["tags", session?.user.id], queryFn: listTags });
    const filtered =
        quizzes.data?.items.filter(
            (quiz) =>
                (scope === "all" || quiz.isOwner) &&
                quiz.currentVersion.title.toLowerCase().includes(search.toLowerCase()),
        ) ?? [];

    return (
        <div className="page-stack">
            <div className="page-heading">
                <div>
                    <p className="eyebrow">Quiz builder</p>
                    <h1>Quizzes</h1>
                    <p className="muted">
                        Create and revise quizzes while keeping earlier attempts intact.
                    </p>
                </div>
                <Link className="button" to="/quizzes/new">
                    New quiz
                </Link>
            </div>
            <section className="panel" aria-label="Quiz filters">
                <div className="filter-grid">
                    <label>
                        Search titles
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
                                <option key={item.id} value={item.slug}>
                                    {item.name}
                                </option>
                            ))}
                        </select>
                    </label>
                    <label>
                        Show
                        <select value={scope} onChange={(event) => setScope(event.target.value)}>
                            <option value="mine">My quizzes</option>
                            <option value="all">My quizzes and public quizzes</option>
                        </select>
                    </label>
                </div>
                <p className="muted small">
                    Title and ownership filters apply to this page of results.
                </p>
            </section>
            {quizzes.isPending ? <p role="status">Loading quizzes…</p> : null}
            {quizzes.isError ? (
                <div className="message-panel" role="alert">
                    <p>Could not load quizzes. {quizzes.error.message}</p>
                    <button type="button" onClick={() => void quizzes.refetch()}>
                        Try again
                    </button>
                </div>
            ) : null}
            {quizzes.data ? (
                <section aria-label="Quizzes">
                    <div className="section-heading">
                        <h2>Quizzes</h2>
                        <span className="muted">{filtered.length} on this page</span>
                    </div>
                    {filtered.length ? (
                        <ul className="card-list">
                            {filtered.map((quiz) => (
                                <li className="question-card" key={quiz.id}>
                                    <Link
                                        className="question-link"
                                        to="/quizzes/$quizId"
                                        params={{ quizId: quiz.id }}
                                    >
                                        {quiz.currentVersion.title}
                                    </Link>
                                    <p className="muted small">
                                        {quiz.currentVersion.questions.length} questions · Quiz
                                        version {quiz.currentVersion.versionNumber}
                                    </p>
                                    <div className="tag-row">
                                        <span className="tag">{quiz.status}</span>
                                        <span className="tag">{quiz.visibility}</span>
                                        {quiz.tags.map((item) => (
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
                            <p>No quizzes match these filters.</p>
                        </div>
                    )}
                    <div className="pagination">
                        <button
                            type="button"
                            className="secondary"
                            disabled={offset === 0}
                            onClick={() => setOffset(Math.max(0, offset - 50))}
                        >
                            Previous
                        </button>
                        <span>Page {Math.floor(offset / 50) + 1}</span>
                        <button
                            type="button"
                            className="secondary"
                            disabled={quizzes.data.nextOffset === null}
                            onClick={() => setOffset(quizzes.data.nextOffset ?? offset)}
                        >
                            Next
                        </button>
                    </div>
                </section>
            ) : null}
        </div>
    );
}
