import { useQuery } from "@tanstack/react-query";

import { getHealth } from "../api/health";

export function HomePage() {
    const health = useQuery({ queryKey: ["health"], queryFn: getHealth });

    return (
        <section className="hero">
            <p className="eyebrow">Study with purpose</p>
            <h1>Build better questions. Remember more.</h1>
            <p className="hero-copy">
                Create focused quizzes and practice the ideas that matter most.
            </p>
            <div className="status-card" aria-live="polite">
                <span className={`status-dot ${health.isSuccess ? "online" : ""}`} />
                {health.isPending && "Connecting to the API…"}
                {health.isSuccess && "API connected"}
                {health.isError && "API unavailable — start the backend to connect."}
            </div>
        </section>
    );
}
