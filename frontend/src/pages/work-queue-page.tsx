import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import type { WorkItem } from "@quiz-builder/contracts";
import {
    cancelWorkItem,
    claimWorkItem,
    decideWorkItem,
    failWorkItem,
    listWorkItems,
} from "../api/content-workflow";
import { useAuth } from "../auth/auth-state";

function WorkItemPanel({ item, refresh }: { item: WorkItem; refresh: () => Promise<void> }) {
    const [findings, setFindings] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const active =
        item.status === "claimed" &&
        item.claimToken &&
        item.leaseUntil &&
        new Date(item.leaseUntil) > new Date();
    const canClaim =
        item.status === "pending" ||
        (item.status === "claimed" && item.leaseUntil && new Date(item.leaseUntil) <= new Date());
    async function run(action: () => Promise<unknown>) {
        setBusy(true);
        setError("");
        try {
            await action();
            await refresh();
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "Action failed.");
        } finally {
            setBusy(false);
        }
    }
    const review = item.itemType === "REVIEW_QUESTION";
    const gate = item.itemType === "APPROVE_PUBLICATION";
    return (
        <li className="panel form-grid">
            <div>
                <strong>{item.prompt ?? item.itemType}</strong>
                <p className="muted small">
                    {item.queueName} · {item.status} · attempt {item.attempts}/3
                    {item.versionNumber ? ` · version ${item.versionNumber}` : ""}
                </p>
                {item.questionId ? (
                    <Link to="/questions/mine/$questionId" params={{ questionId: item.questionId }}>
                        Open question
                    </Link>
                ) : null}
            </div>
            {canClaim && (review || gate) ? (
                <button
                    type="button"
                    disabled={busy}
                    onClick={() => void run(() => claimWorkItem(item.id))}
                >
                    Claim item
                </button>
            ) : null}
            {active && (review || gate) ? (
                <>
                    <label>
                        Findings
                        <textarea
                            value={findings}
                            onChange={(event) => setFindings(event.target.value)}
                            placeholder="Explain requested changes or rejection"
                        />
                    </label>
                    <div className="quiz-actions">
                        <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                                void run(() =>
                                    decideWorkItem(
                                        item.id,
                                        item.claimToken!,
                                        review ? "approved" : "approve_and_publish",
                                        findings,
                                    ),
                                )
                            }
                        >
                            {review ? "Approve content" : "Approve and publish"}
                        </button>
                        <button
                            type="button"
                            className="secondary"
                            disabled={busy || !findings.trim()}
                            onClick={() =>
                                void run(() =>
                                    decideWorkItem(
                                        item.id,
                                        item.claimToken!,
                                        "changes_requested",
                                        findings,
                                    ),
                                )
                            }
                        >
                            Request changes
                        </button>
                        <button
                            type="button"
                            className="secondary"
                            disabled={busy || !findings.trim()}
                            onClick={() =>
                                void run(() =>
                                    decideWorkItem(item.id, item.claimToken!, "rejected", findings),
                                )
                            }
                        >
                            Reject
                        </button>
                        <button
                            type="button"
                            className="secondary"
                            disabled={busy}
                            onClick={() =>
                                void run(() =>
                                    failWorkItem(item.id, item.claimToken!, "Returned by reviewer"),
                                )
                            }
                        >
                            Return to queue
                        </button>
                    </div>
                </>
            ) : null}
            {item.itemType === "REVISE_QUESTION" && item.status === "pending" ? (
                <p className="muted small">
                    Save a new question version to close this revision task, then submit it for
                    review.
                </p>
            ) : null}
            {item.status === "pending" || item.status === "claimed" ? (
                <button
                    type="button"
                    className="secondary"
                    disabled={busy}
                    onClick={() => void run(() => cancelWorkItem(item.id))}
                >
                    Cancel item
                </button>
            ) : null}
            {error ? (
                <p role="alert" className="error-text">
                    {error}
                </p>
            ) : null}
        </li>
    );
}

export function WorkQueuePage() {
    const { session } = useAuth();
    const client = useQueryClient();
    const work = useQuery({ queryKey: ["work-items", session?.user.id], queryFn: listWorkItems });
    const refresh = async () => {
        await client.invalidateQueries({ queryKey: ["work-items", session?.user.id] });
        await client.invalidateQueries({ queryKey: ["questions"] });
    };
    const items = work.data?.items ?? [];
    return (
        <div className="page-stack narrow">
            <div>
                <p className="eyebrow">Content workflow</p>
                <h1>Work queue</h1>
                <p className="muted">
                    Content approval sends a version to the publication queue. It stays unpublished
                    until the final gate approves it.
                </p>
            </div>
            {work.isPending ? <p role="status">Loading work…</p> : null}
            {work.isError ? <p role="alert">{work.error.message}</p> : null}
            {work.data && !items.length ? <p>No work items yet.</p> : null}
            <ol className="version-list">
                {items.map((item) => (
                    <WorkItemPanel key={item.id} item={item} refresh={refresh} />
                ))}
            </ol>
        </div>
    );
}
