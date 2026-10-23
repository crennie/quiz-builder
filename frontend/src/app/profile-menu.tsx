import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { ThemeToggle } from "./theme-toggle";

export function ProfileMenu({ onSignOut }: { onSignOut: () => void }) {
    const menuRef = useRef<HTMLDetailsElement>(null);
    const triggerRef = useRef<HTMLElement>(null);

    useEffect(() => {
        function dismiss(event: PointerEvent) {
            if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
                menuRef.current?.removeAttribute("open");
            }
        }
        document.addEventListener("pointerdown", dismiss);
        return () => document.removeEventListener("pointerdown", dismiss);
    }, []);

    return (
        <details
            className="profile-menu"
            ref={menuRef}
            onKeyDown={(event) => {
                if (event.key === "Escape") {
                    menuRef.current?.removeAttribute("open");
                    triggerRef.current?.focus();
                }
            }}
            onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                    menuRef.current?.removeAttribute("open");
                }
            }}
        >
            <summary ref={triggerRef} className="profile-trigger" aria-label="Profile menu">
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    aria-hidden="true"
                >
                    <circle cx="12" cy="8" r="3.5" />
                    <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
                </svg>
            </summary>
            <div className="profile-dropdown">
                <Link to="/profile" onClick={() => menuRef.current?.removeAttribute("open")}>
                    Profile
                </Link>
                <Link to="/attempts" onClick={() => menuRef.current?.removeAttribute("open")}>
                    Attempt History
                </Link>
                <ThemeToggle />
                <button type="button" className="profile-sign-out" onClick={onSignOut}>
                    Sign Out
                </button>
            </div>
        </details>
    );
}
