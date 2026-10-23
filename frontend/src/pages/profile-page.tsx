import { Link } from "@tanstack/react-router";

import { useAuth } from "../auth/auth-state";
import styles from "./profile-page.module.css";

export function ProfilePage() {
    const { session } = useAuth();
    if (!session) return null;

    const user = session.user;
    const name: unknown = user.user_metadata["display_name"] ?? user.user_metadata["full_name"];
    const joined = new Date(user.created_at);

    return (
        <section className="page-stack narrow">
            <header>
                <p className="eyebrow">Your account</p>
                <h1>Profile</h1>
            </header>
            <section className="panel" aria-label="Account details">
                <dl className={styles.details}>
                    {typeof name === "string" && name.trim() ? (
                        <div>
                            <dt>Name</dt>
                            <dd>{name}</dd>
                        </div>
                    ) : null}
                    <div>
                        <dt>Email</dt>
                        <dd>{user.email ?? "Not provided"}</dd>
                    </div>
                    <div>
                        <dt>Member since</dt>
                        <dd>
                            {Number.isNaN(joined.getTime())
                                ? "Unavailable"
                                : joined.toLocaleDateString()}
                        </dd>
                    </div>
                </dl>
            </section>
            <section className="panel" aria-labelledby="profile-activity">
                <h2 id="profile-activity">Your learning activity</h2>
                <p className="muted">
                    Revisit your quiz results or continue an unfinished attempt.
                </p>
                <Link className="button" to="/attempts">
                    View attempt history
                </Link>
            </section>
        </section>
    );
}
