import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import type { QuestionVersionContent, Visibility } from "@quiz-builder/contracts";

import {
    archiveQuestion,
    assignQuestionTag,
    createQuestionVersion,
    getQuestion,
    getQuestionVersions,
    listTags,
    removeQuestionTag,
    publishQuestion,
    restoreQuestion,
    unpublishQuestion,
    updateQuestionMetadata,
} from "../api/questions";
import { useAuth } from "../auth/auth-state";
import { QuestionEditor } from "../components/question-editor";
import { submitQuestionReview } from "../api/content-workflow";

export function QuestionDetailPage() {
    const { questionId } = useParams({ from: "/questions/mine/$questionId" });
    const { session } = useAuth();
    const queryClient = useQueryClient();
    const [tagId, setTagId] = useState("");
    const [actionError, setActionError] = useState("");
    const question = useQuery({
        queryKey: ["question", session?.user.id, questionId],
        queryFn: () => getQuestion(questionId),
    });
    const tags = useQuery({ queryKey: ["tags", session?.user.id], queryFn: listTags });
    const versions = useQuery({
        queryKey: ["question-versions", session?.user.id, questionId],
        queryFn: () => getQuestionVersions(questionId),
        enabled: question.data?.isOwner === true,
    });
    const saveVersion = useMutation({
        mutationFn: (content: QuestionVersionContent) => createQuestionVersion(questionId, content),
        onSuccess: () => {
            void refresh();
        },
    });
    const updateMetadata = useMutation({
        mutationFn: (value: { visibility: Visibility }) =>
            updateQuestionMetadata(questionId, value),
        onSuccess: () => {
            void refresh();
        },
    });
    const lifecycle = useMutation({
        mutationFn: (action: "publish" | "unpublish" | "archive" | "restore") => {
            if (action === "publish")
                return publishQuestion(questionId, question.data!.currentVersion.id);
            if (action === "unpublish") return unpublishQuestion(questionId);
            if (action === "archive") return archiveQuestion(questionId);
            return restoreQuestion(questionId);
        },
        onSuccess: () => {
            void refresh();
        },
    });
    const submitReview = useMutation({
        mutationFn: () => submitQuestionReview(questionId, question.data!.currentVersion.id),
        onSuccess: () => {
            void queryClient.invalidateQueries({ queryKey: ["work-items"] });
        },
    });
    const assignTag = useMutation({
        mutationFn: (id: string) => assignQuestionTag(questionId, id),
        onSuccess: () => {
            setTagId("");
            void refresh();
        },
    });
    const removeTag = useMutation({
        mutationFn: (id: string) => removeQuestionTag(questionId, id),
        onSuccess: () => {
            void refresh();
        },
    });

    async function refresh() {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["question", session?.user.id, questionId] }),
            queryClient.invalidateQueries({
                queryKey: ["question-versions", session?.user.id, questionId],
            }),
            queryClient.invalidateQueries({ queryKey: ["questions"] }),
        ]);
    }
    async function changeMetadata(value: { visibility: Visibility }) {
        setActionError("");
        try {
            await updateMetadata.mutateAsync(value);
        } catch (error) {
            setActionError(error instanceof Error ? error.message : "Could not update question.");
        }
    }
    async function changeLifecycle(action: "publish" | "unpublish" | "archive" | "restore") {
        setActionError("");
        try {
            await lifecycle.mutateAsync(action);
        } catch (error) {
            setActionError(
                error instanceof Error ? error.message : "Could not change question lifecycle.",
            );
        }
    }
    async function addTag() {
        if (!tagId) return;
        setActionError("");
        try {
            await assignTag.mutateAsync(tagId);
        } catch (error) {
            setActionError(error instanceof Error ? error.message : "Could not add tag.");
        }
    }
    async function sendForReview() {
        setActionError("");
        try {
            await submitReview.mutateAsync();
        } catch (error) {
            setActionError(error instanceof Error ? error.message : "Could not submit review.");
        }
    }
    async function dropTag(id: string) {
        setActionError("");
        try {
            await removeTag.mutateAsync(id);
        } catch (error) {
            setActionError(error instanceof Error ? error.message : "Could not remove tag.");
        }
    }

    if (question.isPending) return <p role="status">Loading question…</p>;
    if (question.isError)
        return (
            <div className="message-panel" role="alert">
                <h1>Question unavailable</h1>
                <p>{question.error.message}</p>
                <Link to="/questions/mine">Return to my questions</Link>
            </div>
        );
    const current = question.data;
    const availableTags =
        tags.data?.filter((item) => !current.tags.some((assigned) => assigned.id === item.id)) ??
        [];
    return (
        <div className="page-stack narrow">
            <Link to="/questions/mine">← My questions</Link>
            <div>
                <p className="eyebrow">Question · Version {current.currentVersion.versionNumber}</p>
                <h1>{current.currentVersion.prompt}</h1>
                <p className="muted">
                    {current.currentVersion.questionType.replaceAll("_", " ")} · {current.status} ·{" "}
                    {current.visibility}
                </p>
            </div>
            {current.isOwner ? (
                <>
                    <section className="panel form-grid">
                        <h2>Access and lifecycle</h2>
                        <label>
                            Visibility
                            <select
                                aria-label="Visibility"
                                value={current.visibility}
                                disabled={updateMetadata.isPending}
                                onChange={(event) => {
                                    void changeMetadata({
                                        visibility: event.target.value as Visibility,
                                    });
                                }}
                            >
                                <option value="private">Private</option>
                                <option value="unlisted">Unlisted</option>
                                <option value="public">Public</option>
                            </select>
                        </label>
                        <div className="quiz-actions">
                            {current.status === "archived" ? (
                                <button
                                    type="button"
                                    onClick={() => void changeLifecycle("restore")}
                                >
                                    Restore question
                                </button>
                            ) : (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => void changeLifecycle("publish")}
                                    >
                                        Publish current version
                                    </button>
                                    <button
                                        type="button"
                                        className="secondary"
                                        disabled={submitReview.isPending}
                                        onClick={() => void sendForReview()}
                                    >
                                        Submit for review
                                    </button>
                                    {current.status === "published" ? (
                                        <button
                                            type="button"
                                            className="secondary"
                                            onClick={() => void changeLifecycle("unpublish")}
                                        >
                                            Unpublish question
                                        </button>
                                    ) : null}
                                    <button
                                        type="button"
                                        className="secondary"
                                        onClick={() => void changeLifecycle("archive")}
                                    >
                                        Archive question
                                    </button>
                                </>
                            )}
                        </div>
                        <p className="muted small">
                            Direct publication is available for your own unsubmitted version.
                            Submitting it for review sends it through content approval and a final
                            publication gate. <Link to="/work-items">Open the work queue</Link>.
                        </p>
                    </section>
                    <section className="panel">
                        <h2>Tags</h2>
                        <div className="tag-row">
                            {current.tags.length ? (
                                current.tags.map((item) => (
                                    <button
                                        className="tag removable"
                                        type="button"
                                        key={item.id}
                                        onClick={() => {
                                            void dropTag(item.id);
                                        }}
                                        aria-label={`Remove ${item.name} tag`}
                                    >
                                        {item.name} ×
                                    </button>
                                ))
                            ) : (
                                <span className="muted">No tags yet.</span>
                            )}
                        </div>
                        <div className="inline-form">
                            <label className="sr-only" htmlFor="assign-tag">
                                Tag to add
                            </label>
                            <select
                                id="assign-tag"
                                value={tagId}
                                onChange={(event) => setTagId(event.target.value)}
                            >
                                <option value="">Choose a tag</option>
                                {availableTags.map((item) => (
                                    <option value={item.id} key={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                onClick={() => {
                                    void addTag();
                                }}
                                disabled={!tagId || assignTag.isPending}
                            >
                                Add tag
                            </button>
                        </div>
                        <p className="muted small">Create tags in the question bank.</p>
                    </section>
                    {actionError ? (
                        <p role="alert" className="error-text">
                            {actionError}
                        </p>
                    ) : null}
                    {current.status === "archived" ? (
                        <section className="panel">
                            <h2>Archived question</h2>
                            <p className="muted">Archived questions cannot be revised.</p>
                        </section>
                    ) : (
                        <section className="panel">
                            <h2>Revise question</h2>
                            <p className="muted">
                                Saving creates a new immutable version. Existing quizzes keep their
                                selected version.
                            </p>
                            <QuestionEditor
                                key={current.currentVersion.id}
                                initial={current.currentVersion}
                                submitLabel="Save new version"
                                busy={saveVersion.isPending}
                                onSave={async (content) => {
                                    await saveVersion.mutateAsync(content);
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
                                        {version.prompt}
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
                    <h2>Question content</h2>
                    <p>{current.currentVersion.prompt}</p>
                </section>
            )}
        </div>
    );
}
