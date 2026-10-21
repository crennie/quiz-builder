import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { Modal } from "./modal";

it("closes on Escape, restores focus, and releases the scroll lock", async () => {
    function Example() {
        const [open, setOpen] = useState(false);
        return (
            <>
                <button onClick={() => setOpen(true)}>Open feedback</button>
                <Modal open={open} title="Feedback" onClose={() => setOpen(false)}>
                    <input aria-label="Comment" />
                </Modal>
            </>
        );
    }
    const user = userEvent.setup();
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Open feedback" });
    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Feedback" });
    expect(document.body.style.overflow).toBe("hidden");
    screen.getByRole("textbox").focus();
    fireEvent(dialog, new Event("cancel", { cancelable: true }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(document.body.style.overflow).toBe("");
});

it("prevents dismissal during work and restores scrolling on unmount", () => {
    const onClose = vi.fn();
    const { unmount } = render(
        <Modal open title="Importing quiz" dismissible={false} onClose={onClose}>
            Working…
        </Modal>,
    );
    const event = new Event("cancel", { cancelable: true });
    fireEvent(screen.getByRole("dialog"), event);
    expect(event.defaultPrevented).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    unmount();
    expect(document.body.style.overflow).toBe("");
});
