import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { requestAgentQuestion } from "../api/content-workflow";

export function AgentQuestionPage() {
    const [brief, setBrief] = useState("");
    const [requestKey, setRequestKey] = useState(() => crypto.randomUUID());
    const client = useQueryClient();
    const navigate = useNavigate();
    const request = useMutation({
        mutationFn: () => requestAgentQuestion(brief.trim(), requestKey),
    });
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (brief.trim().length < 10) return;
        try {
            await request.mutateAsync();
            setRequestKey(crypto.randomUUID());
            await client.invalidateQueries({ queryKey: ["work-items"] });
            void navigate({ to: "/work-items" });
        } catch {
            /* The mutation error is shown below; keep the request key for retry. */
        }
    }
    return (
        <div className="page-stack narrow">
            <Link to="/questions/mine">← My questions</Link>
            <div>
                <p className="eyebrow">Agent creation</p>
                <h1>Generate a question</h1>
                <p className="muted">
                    The generated question will be a private draft assigned to you. A human content
                    review and publication gate are required before it can enter the bank.
                </p>
            </div>
            <form className="panel form-grid" onSubmit={(event) => void submit(event)}>
                <label>
                    Question brief
                    <textarea
                        value={brief}
                        minLength={10}
                        maxLength={1000}
                        required
                        onChange={(event) => {
                            setBrief(event.target.value);
                            setRequestKey(crypto.randomUUID());
                        }}
                        placeholder="Describe the subject, difficulty, and kind of question to create"
                    />
                </label>
                <button type="submit" disabled={request.isPending || brief.trim().length < 10}>
                    Queue generation
                </button>
                {request.isError ? (
                    <p role="alert" className="error-text">
                        {request.error.message}
                    </p>
                ) : null}
            </form>
        </div>
    );
}
