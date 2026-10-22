import { Link } from "@tanstack/react-router";

export function HomePage() {
    return (
        <section className="hero">
            <p className="eyebrow">Study with purpose</p>
            <div className="hero-brand">
                <img src="/brand/quiz-builder.png" alt="" width="160" height="160" />
                <h1 className="brand-wordmark">
                    Quiz <span>Builder</span>
                </h1>
            </div>
            <p className="hero-copy">Choose where you want to start.</p>
            <nav aria-label="Learning destinations">
                <Link className="button" to="/quizzes">
                    My Quizzes
                </Link>{" "}
                <Link className="button" to="/courses/mine">
                    My Courses
                </Link>{" "}
                <Link className="button" to="/courses">
                    Courses
                </Link>
            </nav>
        </section>
    );
}
