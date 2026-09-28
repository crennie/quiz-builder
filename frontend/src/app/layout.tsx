import { Link, Outlet } from "@tanstack/react-router";

export function AppLayout() {
    return (
        <div className="app-shell">
            <header className="site-header">
                <Link className="brand" to="/">
                    Quiz Builder
                </Link>
                <nav aria-label="Primary navigation">
                    <Link to="/">Home</Link>
                </nav>
            </header>
            <main className="page-content">
                <Outlet />
            </main>
        </div>
    );
}
