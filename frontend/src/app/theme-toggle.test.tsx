import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { applyTheme, readTheme } from "./theme";
import { ThemeToggle } from "./theme-toggle";

afterEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    vi.restoreAllMocks();
});

it("defaults to the system theme and remembers explicit choices", async () => {
    const user = userEvent.setup();
    applyTheme(readTheme());
    const view = render(<ThemeToggle />);
    const select = screen.getByRole("combobox", { name: "Theme" });
    expect(select).toHaveValue("system");
    expect(document.documentElement).toHaveAttribute("data-theme", "system");

    await user.selectOptions(select, "dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    view.unmount();
    render(<ThemeToggle />);
    expect(screen.getByRole("combobox", { name: "Theme" })).toHaveValue("dark");

    await user.selectOptions(screen.getByRole("combobox"), "light");
    expect(document.documentElement).toHaveAttribute("data-theme", "light");
    await user.selectOptions(screen.getByRole("combobox"), "system");
    expect(readTheme()).toBe("system");
    expect(document.documentElement).toHaveAttribute("data-theme", "system");
});

it("allows switching themes when browser storage is unavailable", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new Error("Storage unavailable");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("Storage unavailable");
    });
    render(<ThemeToggle />);
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Theme" }), "dark");
    expect(document.documentElement).toHaveAttribute("data-theme", "dark");
    expect(screen.getByRole("combobox")).toHaveValue("dark");
});
