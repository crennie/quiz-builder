import { Link } from "@tanstack/react-router";

export function HomePage() {
    return (
        <section className="hero">
            <p className="eyebrow">Study with purpose</p>
            <h1>Quiz Builder</h1>
            <p className="hero-copy">Choose where you want to start.</p>
            <nav aria-label="Learning destinations">
                <Link className="button" to="/quizzes">
                    My Quizzes
                </Link>{" "}
                <Link className="button" to="/courses">
                    Courses
                </Link>
            </nav>
        </section>
    );
}
