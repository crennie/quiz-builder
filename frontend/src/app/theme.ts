export type Theme = "system" | "light" | "dark";

export function readTheme(): Theme {
    try {
        const stored = localStorage.getItem("quiz-builder-theme");
        if (stored === "light" || stored === "dark") return stored;
    } catch {
        // Browser preferences still work when storage is unavailable.
    }
    return "system";
}

export function applyTheme(theme: Theme) {
    document.documentElement.dataset.theme = theme;
}

export function saveTheme(theme: Theme) {
    applyTheme(theme);
    try {
        localStorage.setItem("quiz-builder-theme", theme);
    } catch {
        // Keep the selected theme for this visit when storage is unavailable.
    }
}
