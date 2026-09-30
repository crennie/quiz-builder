import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";

import { getBankQuestion, getPublishedQuestionVersions } from "../api/questions";
import { useAuth } from "../auth/auth-state";

export function BankQuestionDetailPage() {
    const { questionId } = useParams({ from: "/questions/$questionId" });
    const { session } = useAuth();
    const question = useQuery({
        queryKey: ["bank-question", session?.user.id, questionId],
        queryFn: () => getBankQuestion(questionId),
    });
    const versions = useQuery({
        queryKey: ["published-question-versions", session?.user.id, questionId],
        queryFn: () => getPublishedQuestionVersions(questionId),
        enabled: question.isSuccess,
    });

    if (question.isPending) return <p role="status">Loading question…</p>;
    if (question.isError) {
        return (
            <div className="message-panel" role="alert">
                <h1>Question unavailable</h1>
                <p>{question.error.message}</p>
                <Link to="/questions">Return to question bank</Link>
            </div>
        );
    }
    const current = question.data;
    return (
        <div className="page-stack narrow">
            <Link to="/questions">← Question bank</Link>
            <div>
                <p className="eyebrow">Published question</p>
                <h1>{current.publishedVersion.prompt}</h1>
                <p className="muted">
                    {current.visibility} · Version {current.publishedVersion.versionNumber}
                    {current.publishedVersion.agentRunId ? " · Agent generated" : ""}
                </p>
            </div>
            {current.isOwner ? (
                <Link to="/questions/mine/$questionId" params={{ questionId }}>
                    Manage question and drafts
                </Link>
            ) : null}
            <section className="panel">
                <h2>Published versions</h2>
                {versions.isPending ? <p role="status">Loading versions…</p> : null}
                {versions.isError ? (
                    <p role="alert">Could not load versions. {versions.error.message}</p>
                ) : null}
                {versions.data ? (
                    <ol className="version-list">
                        {versions.data.versions.map((version) => (
                            <li key={version.id}>
                                <strong>Version {version.versionNumber}</strong>
                                {version.agentRunId ? " · Agent generated" : ""} · {version.prompt}
                            </li>
                        ))}
                    </ol>
                ) : null}
            </section>
        </div>
    );
}
