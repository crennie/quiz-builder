import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createFeedback } from "../api/feedback";
import { FeedbackForm } from "./feedback-form";

vi.mock("../api/feedback", () => ({ createFeedback: vi.fn() }));

it("preserves feedback drafts and submits the explicit target from the dialog", async () => {
    vi.mocked(createFeedback)
        .mockRejectedValueOnce(new Error("Please retry"))
        .mockResolvedValueOnce({} as Awaited<ReturnType<typeof createFeedback>>);
    const user = userEvent.setup();
    render(
        <QueryClientProvider client={new QueryClient()}>
            <FeedbackForm target={{ questionId: "question-id" }} />
        </QueryClientProvider>,
    );
    const trigger = screen.getByRole("button", { name: "Send feedback" });
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    await user.click(trigger);
    let dialog = screen.getByRole("dialog", { name: "Send feedback" });
    await user.type(within(dialog).getByLabelText("Feedback"), "Check this answer.");
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(trigger).toHaveFocus();
    await user.click(trigger);
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Feedback")).toHaveValue("Check this answer.");
    await user.click(within(dialog).getByRole("button", { name: "Send feedback" }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Please retry");
    await user.click(within(dialog).getByRole("button", { name: "Send feedback" }));
    expect(await within(dialog).findByRole("status")).toHaveTextContent(
        "Feedback sent. Thank you.",
    );
    expect(vi.mocked(createFeedback).mock.calls.at(-1)?.[0]).toEqual({
        questionId: "question-id",
        category: "other",
        comment: "Check this answer.",
    });
});
