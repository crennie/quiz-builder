import { Link } from "react-router-dom";

export function NotFoundPage() {
    return (
        <section className="centered-message">
            <p className="eyebrow">404</p>
            <h1>Page not found</h1>
            <p>That page does not exist.</p>
            <Link to="/">Return home</Link>
        </section>
    );
}
