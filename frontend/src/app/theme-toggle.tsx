import { useState } from "react";

import { readTheme, saveTheme, type Theme } from "./theme";

export function ThemeToggle() {
    const [theme, setTheme] = useState(readTheme);

    return (
        <label className="theme-control">
            Theme
            <select
                value={theme}
                onChange={(event) => {
                    const next = event.target.value as Theme;
                    saveTheme(next);
                    setTheme(next);
                }}
            >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
            </select>
        </label>
    );
}
