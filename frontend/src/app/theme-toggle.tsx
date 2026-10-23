import { useEffect, useState } from "react";

import { readTheme, saveTheme } from "./theme";

export function ThemeToggle() {
    const [theme, setTheme] = useState(readTheme);
    const [systemDark, setSystemDark] = useState(
        () => window.matchMedia("(prefers-color-scheme: dark)").matches,
    );

    useEffect(() => {
        const preference = window.matchMedia("(prefers-color-scheme: dark)");
        const update = () => setSystemDark(preference.matches);
        preference.addEventListener("change", update);
        return () => preference.removeEventListener("change", update);
    }, []);

    const dark = theme === "dark" || (theme === "system" && systemDark);

    return (
        <button
            className="theme-control"
            type="button"
            role="switch"
            aria-label="Dark theme"
            aria-checked={dark}
            onClick={() => {
                const next = dark ? "light" : "dark";
                saveTheme(next);
                setTheme(next);
            }}
        >
            <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                aria-hidden="true"
            >
                {dark ? (
                    <path d="M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z" />
                ) : (
                    <>
                        <circle cx="12" cy="12" r="4" />
                        <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
                    </>
                )}
            </svg>
            <span>Theme</span>
            <span className="theme-switch" aria-hidden="true" />
        </button>
    );
}
