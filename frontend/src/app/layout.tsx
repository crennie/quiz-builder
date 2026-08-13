import { NavLink, Outlet } from "react-router-dom";

export function AppLayout() {
    return (
        <div className="app-shell">
            <header className="site-header">
                <NavLink className="brand" to="/">
                    Quiz Builder
                </NavLink>
                <nav aria-label="Primary navigation">
                    <NavLink to="/" end>
                        Home
                    </NavLink>
                </nav>
            </header>
            <main className="page-content">
                <Outlet />
            </main>
        </div>
    );
}
