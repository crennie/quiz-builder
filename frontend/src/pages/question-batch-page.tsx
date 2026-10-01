import { questionBatchArtifactSchema, type QuestionBatchArtifact } from "@quiz-builder/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import {
    getQuestionBatch,
    ingestQuestionBatch,
    listQuestionBatches,
    materializeQuestionBatch,
    submitQuestionReview,
} from "../api/content-workflow";
import { useAuth } from "../auth/auth-state";

export function QuestionBatchPage() {
    const { session } = useAuth();
    const client = useQueryClient();
    const [artifact, setArtifact] = useState<QuestionBatchArtifact | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [error, setError] = useState("");
    const batches = useQuery({
        queryKey: ["question-batches", session?.user.id],
        queryFn: listQuestionBatches,
    });
    const selected = useQuery({
        queryKey: ["question-batch", session?.user.id, selectedId],
        queryFn: () => getQuestionBatch(selectedId!),
        enabled: !!selectedId,
    });
    const ingest = useMutation({
        mutationFn: ingestQuestionBatch,
        onSuccess: async (batch) => {
            setSelectedId(batch.id);
            setArtifact(null);
            await client.invalidateQueries({ queryKey: ["question-batches"] });
            await client.invalidateQueries({
                queryKey: ["question-batch", session?.user.id, batch.id],
            });
        },
    });
    const materialize = useMutation({
        mutationFn: materializeQuestionBatch,
        onSuccess: async (batch) => {
            await client.invalidateQueries({ queryKey: ["question-batches"] });
            await client.invalidateQueries({
                queryKey: ["question-batch", session?.user.id, batch.id],
            });
            await client.invalidateQueries({ queryKey: ["questions"] });
            await client.invalidateQueries({ queryKey: ["tags"] });
        },
    });
    const review = useMutation({
        mutationFn: ({ questionId, versionId }: { questionId: string; versionId: string }) =>
            submitQuestionReview(questionId, versionId),
        onSuccess: async () => {
            await client.invalidateQueries({ queryKey: ["work-items"] });
        },
    });

    async function readFile(file: File | undefined) {
        setArtifact(null);
        setError("");
        if (!file) return;
        if (file.size > 256 * 1024) {
            setError("Batch file must be 256 KiB or smaller");
            return;
        }
        try {
            const document: unknown = JSON.parse(await file.text());
            setArtifact(questionBatchArtifactSchema.parse(document));
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Invalid batch JSON file");
        }
    }

    const current = selected.data;
    return (
        <div className="page-stack narrow">
            <Link to="/questions/mine">← My questions</Link>
            <div>
                <p className="eyebrow">Batch ingestion</p>
                <h1>Import questions</h1>
                <p className="muted">
                    Upload one versioned JSON batch. Import retains the artifact; materialization
                    creates private drafts. Submit each draft for review when ready.
                </p>
            </div>
            <section className="panel form-grid">
                <label>
                    Question batch JSON
                    <input
                        type="file"
                        accept=".json,application/json"
                        onChange={(event) => void readFile(event.target.files?.[0])}
                    />
                </label>
                {error ? (
                    <p role="alert" className="error-text">
                        {error}
                    </p>
                ) : null}
                {artifact ? (
                    <>
                        <p>
                            {artifact.topic} · {artifact.questions.length} questions · declared
                            source: {artifact.source.kind} ({artifact.source.label})
                        </p>
                        <p>Tags: {artifact.tags.join(", ") || "none"}</p>
                        <ol>
                            {artifact.questions.map((question) => (
                                <li key={question.key}>
                                    {question.key}: {question.content.prompt}
                                </li>
                            ))}
                        </ol>
                        <details>
                            <summary>Inspect complete batch</summary>
                            <pre className="artifact-preview">
                                {JSON.stringify(artifact, null, 2)}
                            </pre>
                        </details>
                        <button
                            type="button"
                            disabled={ingest.isPending}
                            onClick={() => ingest.mutate(artifact)}
                        >
                            Retain batch artifact
                        </button>
                    </>
                ) : null}
                {ingest.isError ? (
                    <p role="alert" className="error-text">
                        {ingest.error.message}
                    </p>
                ) : null}
            </section>
            <section className="panel">
                <h2>Recent batches</h2>
                {batches.isError ? <p role="alert">{batches.error.message}</p> : null}
                <ul>
                    {batches.data?.batches.map((batch) => (
                        <li key={batch.id}>
                            <button type="button" onClick={() => setSelectedId(batch.id)}>
                                {batch.topic} · {batch.materializedCount}/{batch.questionCount}{" "}
                                drafts
                            </button>
                        </li>
                    ))}
                </ul>
            </section>
            {selected.isError ? <p role="alert">{selected.error.message}</p> : null}
            {current ? (
                <section className="panel form-grid">
                    <h2>{current.artifact.topic}</h2>
                    <p>
                        Declared source: {current.artifact.source.kind} (
                        {current.artifact.source.label}). Uploaded by your account. SHA-256:{" "}
                        <code>{current.artifactSha256}</code>
                    </p>
                    <details>
                        <summary>Inspect retained artifact</summary>
                        <pre className="artifact-preview">
                            {JSON.stringify(current.artifact, null, 2)}
                        </pre>
                    </details>
                    {current.items.length === 0 ? (
                        <button
                            type="button"
                            disabled={materialize.isPending}
                            onClick={() => materialize.mutate(current.id)}
                        >
                            Create private drafts
                        </button>
                    ) : (
                        <ol>
                            {current.items.map((item) => (
                                <li key={item.key}>
                                    <Link
                                        to="/questions/mine/$questionId"
                                        params={{ questionId: item.questionId }}
                                    >
                                        {item.key}:{" "}
                                        {
                                            current.artifact.questions.find(
                                                (question) => question.key === item.key,
                                            )?.content.prompt
                                        }
                                    </Link>{" "}
                                    <button
                                        type="button"
                                        disabled={review.isPending}
                                        onClick={() =>
                                            review.mutate({
                                                questionId: item.questionId,
                                                versionId: item.currentVersionId,
                                            })
                                        }
                                    >
                                        Submit for review
                                    </button>
                                </li>
                            ))}
                        </ol>
                    )}
                    {materialize.isError ? <p role="alert">{materialize.error.message}</p> : null}
                    {review.isError ? <p role="alert">{review.error.message}</p> : null}
                    {review.isSuccess ? (
                        <p role="status">Review item queued. Open the work queue to act on it.</p>
                    ) : null}
                </section>
            ) : null}
        </div>
    );
}
