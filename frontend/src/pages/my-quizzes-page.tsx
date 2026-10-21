import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { QuizDetail } from "@quiz-builder/contracts";

import { listQuizzes } from "../api/quizzes";
import { useAuth } from "../auth/auth-state";
import styles from "./my-quizzes-page.module.css";

type SortOrder = "updated" | "title" | "questions";

async function loadAvailableQuizzes() {
    const items: QuizDetail[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
        const page = await listQuizzes({ offset });
        items.push(...page.items);
        offset = page.nextOffset;
    }
    return items;
}

function QuizGrid({ quizzes }: { quizzes: QuizDetail[] }) {
    return (
        <ul className={styles.grid}>
            {quizzes.map((quiz) => (
                <li key={quiz.id}>
                    <Link
                        className={styles.card}
                        to="/quizzes/$quizId"
                        params={{ quizId: quiz.id }}
                    >
                        <div className="tag-row">
                            <span className="tag">{quiz.isOwner ? "My quiz" : "Public quiz"}</span>
                            {quiz.tags.map((tag) => (
                                <span className="tag" key={tag.id}>
                                    {tag.name}
                                </span>
                            ))}
                        </div>
                        <h3>{quiz.title}</h3>
                        <p className="muted">{quiz.description || "No description yet."}</p>
                        <div className={styles.cardFooter}>
                            <span className="muted small">
                                {quiz.questions.length}{" "}
                                {quiz.questions.length === 1 ? "question" : "questions"}
                            </span>
                            <span>Open quiz →</span>
                        </div>
                    </Link>
                </li>
            ))}
        </ul>
    );
}

function QuizFilters({
    search,
    mineOnly,
    sort,
    onSearch,
    onMineOnly,
    onSort,
    onReset,
}: {
    search: string;
    mineOnly: boolean;
    sort: SortOrder;
    onSearch: (value: string) => void;
    onMineOnly: (value: boolean) => void;
    onSort: (value: SortOrder) => void;
    onReset: () => void;
}) {
    return (
        <aside className={`panel ${styles.filters}`} aria-labelledby="quiz-filters-heading">
            <h2 id="quiz-filters-heading">Filter & sort</h2>
            <label>
                Search quizzes
                <input
                    type="search"
                    placeholder="Search by title"
                    value={search}
                    onChange={(event) => onSearch(event.target.value)}
                />
            </label>
            <label className="checkbox-row">
                <input
                    type="checkbox"
                    checked={mineOnly}
                    onChange={(event) => onMineOnly(event.target.checked)}
                />
                Created by me
            </label>
            <label>
                Sort by
                <select value={sort} onChange={(event) => onSort(event.target.value as SortOrder)}>
                    <option value="updated">Recently updated</option>
                    <option value="title">Title: A–Z</option>
                    <option value="questions">Most questions</option>
                </select>
            </label>
            <button type="button" className="secondary" onClick={onReset}>
                Reset filters
            </button>
        </aside>
    );
}

export function MyQuizzesPage() {
    const { session } = useAuth();
    const [search, setSearch] = useState("");
    const [mineOnly, setMineOnly] = useState(false);
    const [sort, setSort] = useState<SortOrder>("updated");
    const quizzes = useQuery({
        queryKey: ["quizzes", session?.user.id, "available-grid"],
        queryFn: loadAvailableQuizzes,
    });
    const filtered = (quizzes.data ?? [])
        .filter(
            (quiz) =>
                (!mineOnly || quiz.isOwner) &&
                quiz.title.toLowerCase().includes(search.trim().toLowerCase()),
        )
        .sort((a, b) => {
            if (sort === "title") return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
            const difference =
                sort === "questions"
                    ? b.questions.length - a.questions.length
                    : Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
            return difference || a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
        });

    return (
        <div className="page-stack">
            <header className="page-heading">
                <div>
                    <p className="eyebrow">Your workspace</p>
                    <h1>My Quizzes</h1>
                    <p className="muted">Pick a quiz to explore or practice.</p>
                </div>
                <div className="quiz-actions">
                    <Link className="button" to="/quizzes/new">
                        Create quiz
                    </Link>
                    <Link className="button" to="/quizzes/import">
                        Import quiz
                    </Link>
                </div>
            </header>
            <div className={styles.layout}>
                <QuizFilters
                    search={search}
                    mineOnly={mineOnly}
                    sort={sort}
                    onSearch={setSearch}
                    onMineOnly={setMineOnly}
                    onSort={setSort}
                    onReset={() => {
                        setSearch("");
                        setMineOnly(false);
                        setSort("updated");
                    }}
                />
                <section
                    className={styles.results}
                    aria-labelledby="available-quizzes-heading"
                    aria-busy={quizzes.isPending}
                >
                    <div className="section-heading">
                        <h2 id="available-quizzes-heading">Available quizzes</h2>
                        {quizzes.data ? (
                            <span className="muted small" role="status">
                                {filtered.length} of {quizzes.data.length}
                            </span>
                        ) : null}
                    </div>
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
                        filtered.length ? (
                            <QuizGrid quizzes={filtered} />
                        ) : (
                            <div className="message-panel">
                                <h3>
                                    {quizzes.data.length ? "No matching quizzes" : "No quizzes yet"}
                                </h3>
                                <p className="muted">
                                    {quizzes.data.length
                                        ? "Try another search or reset your filters."
                                        : "Your available quizzes will appear here."}
                                </p>
                            </div>
                        )
                    ) : null}
                </section>
            </div>
        </div>
    );
}
