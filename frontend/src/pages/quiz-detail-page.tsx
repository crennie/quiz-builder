import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import type { ContentStatus, QuizContent, Visibility } from "@quiz-builder/contracts";

import { listTags } from "../api/questions";
import {
    assignQuizTag,
    getQuiz,
    getQuizVersions,
    removeQuizTag,
    saveQuizContent,
    updateQuizMetadata,
} from "../api/quizzes";
import { useAuth } from "../auth/auth-state";
import { QuizEditor } from "../components/quiz-editor";
import { QuizStartPanel } from "../components/quiz-start-panel";

export function QuizDetailPage() {
    const { quizId } = useParams({ from: "/quizzes/$quizId" });
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const [tagId, setTagId] = useState("");
    const [actionError, setActionError] = useState("");
    const quiz = useQuery({
        queryKey: ["quiz", session?.user.id, quizId],
        queryFn: () => getQuiz(quizId),
    });
    const versions = useQuery({
        queryKey: ["quiz-versions", session?.user.id, quizId],
        queryFn: () => getQuizVersions(quizId),
        enabled: quiz.data?.isOwner === true,
    });
    const tags = useQuery({ queryKey: ["tags", session?.user.id], queryFn: listTags });
    const save = useMutation({
        mutationFn: (content: QuizContent) => saveQuizContent(quizId, content),
    });
    const metadata = useMutation({
        mutationFn: (value: { visibility?: Visibility; status?: ContentStatus }) =>
            updateQuizMetadata(quizId, value),
    });
    const addTag = useMutation({ mutationFn: (id: string) => assignQuizTag(quizId, id) });
    const dropTag = useMutation({ mutationFn: (id: string) => removeQuizTag(quizId, id) });

    async function refresh() {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["quiz", session?.user.id, quizId] }),
            queryClient.invalidateQueries({
                queryKey: ["quiz-versions", session?.user.id, quizId],
            }),
            queryClient.invalidateQueries({ queryKey: ["quizzes"] }),
        ]);
    }

    async function changeMetadata(value: { visibility?: Visibility; status?: ContentStatus }) {
        setActionError("");
        try {
            await metadata.mutateAsync(value);
            await refresh();
        } catch (error) {
            setActionError(error instanceof Error ? error.message : "Could not update quiz.");
        }
    }

    async function assignTag() {
        if (!tagId) return;
        setActionError("");
        try {
            await addTag.mutateAsync(tagId);
            setTagId("");
            await refresh();
        } catch (error) {
            setActionError(error instanceof Error ? error.message : "Could not add tag.");
        }
    }

    async function removeTag(id: string) {
        setActionError("");
        try {
            await dropTag.mutateAsync(id);
            await refresh();
        } catch (error) {
            setActionError(error instanceof Error ? error.message : "Could not remove tag.");
        }
    }

    if (quiz.isPending) return <p role="status">Loading quiz…</p>;
    if (quiz.isError)
        return (
            <div className="message-panel" role="alert">
                <h1>Quiz unavailable</h1>
                <p>{quiz.error.message}</p>
                <Link to="/quizzes">Return to quizzes</Link>
            </div>
        );

    const current = quiz.data;
    const availableTags =
        tags.data?.filter((tag) => !current.tags.some((assigned) => assigned.id === tag.id)) ?? [];
    return (
        <div className="page-stack narrow">
            <Link to="/quizzes">← Quizzes</Link>
            <div>
                <p className="eyebrow">Quiz · Version {current.currentVersion.versionNumber}</p>
                <h1>{current.currentVersion.title}</h1>
                <p className="muted">
                    {current.currentVersion.questions.length} questions · {current.status} ·{" "}
                    {current.visibility}
                </p>
            </div>
            <QuizStartPanel quiz={current} />
            {current.isOwner ? (
                <>
                    <section className="panel form-grid">
                        <h2>Access and lifecycle</h2>
                        <label>
                            Visibility
                            <select
                                aria-label="Visibility"
                                value={current.visibility}
                                disabled={metadata.isPending}
                                onChange={(event) =>
                                    void changeMetadata({
                                        visibility: event.target.value as Visibility,
                                    })
                                }
                            >
                                <option value="private">Private</option>
                                <option value="unlisted">Unlisted</option>
                                <option value="public">Public</option>
                            </select>
                        </label>
                        <label>
                            Status
                            <select
                                aria-label="Status"
                                value={current.status}
                                disabled={metadata.isPending}
                                onChange={(event) =>
                                    void changeMetadata({
                                        status: event.target.value as ContentStatus,
                                    })
                                }
                            >
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                                <option value="archived">Archived</option>
                            </select>
                        </label>
                        <p className="muted small">
                            Visibility, status, and tags do not create a content version. Publish
                            requires at least one saved question.
                        </p>
                    </section>
                    <section className="panel">
                        <h2>Tags</h2>
                        <div className="tag-row">
                            {current.tags.length ? (
                                current.tags.map((tag) => (
                                    <button
                                        type="button"
                                        className="tag removable"
                                        key={tag.id}
                                        onClick={() => void removeTag(tag.id)}
                                        aria-label={`Remove ${tag.name} tag`}
                                    >
                                        {tag.name} ×
                                    </button>
                                ))
                            ) : (
                                <span className="muted">No tags yet.</span>
                            )}
                        </div>
                        <div className="inline-form">
                            <label className="sr-only" htmlFor="quiz-tag">
                                Tag to add
                            </label>
                            <select
                                id="quiz-tag"
                                value={tagId}
                                onChange={(event) => setTagId(event.target.value)}
                            >
                                <option value="">Choose a tag</option>
                                {availableTags.map((tag) => (
                                    <option value={tag.id} key={tag.id}>
                                        {tag.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                disabled={!tagId || addTag.isPending}
                                onClick={() => void assignTag()}
                            >
                                Add tag
                            </button>
                        </div>
                        <p className="muted small">
                            Create tags in the <Link to="/questions">question bank</Link>.
                        </p>
                    </section>
                    {actionError ? (
                        <p role="alert" className="error-text">
                            {actionError}
                        </p>
                    ) : null}
                    {current.status === "archived" ? (
                        <section className="panel">
                            <h2>Archived quiz</h2>
                            <p className="muted">Archived quizzes cannot be revised.</p>
                        </section>
                    ) : (
                        <section className="panel">
                            <h2>Edit quiz content</h2>
                            <p className="muted">
                                Changing content creates a new immutable quiz version. Earlier
                                attempts keep their original content.
                            </p>
                            <QuizEditor
                                key={current.currentVersion.id}
                                initial={current.currentVersion}
                                submitLabel="Save quiz"
                                busy={save.isPending}
                                onSave={async (content) => {
                                    await save.mutateAsync(content);
                                    await refresh();
                                }}
                            />
                        </section>
                    )}
                    <section className="panel">
                        <h2>Version history</h2>
                        {versions.isPending ? <p role="status">Loading versions…</p> : null}
                        {versions.isError ? (
                            <p role="alert">Could not load versions. {versions.error.message}</p>
                        ) : null}
                        {versions.data ? (
                            <ol className="version-list">
                                {versions.data.versions.map((version) => (
                                    <li key={version.id}>
                                        <strong>Version {version.versionNumber}</strong> ·{" "}
                                        {version.title}
                                        <span className="muted small">
                                            {new Date(version.createdAt).toLocaleDateString()}
                                        </span>
                                    </li>
                                ))}
                            </ol>
                        ) : null}
                    </section>
                </>
            ) : (
                <section className="panel">
                    <h2>Quiz content</h2>
                    <p>{current.currentVersion.description}</p>
                    <ol>
                        {current.currentVersion.questions.map((question) => (
                            <li key={question.id}>{question.question.prompt}</li>
                        ))}
                    </ol>
                </section>
            )}
        </div>
    );
}
