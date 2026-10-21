import { act, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ingestQuestionBatch } from "../api/question-batches";
import { renderAt } from "../test/render-route";

vi.mock("../api/question-batches", () => ({
    ingestQuestionBatch: vi.fn(),
    materializeQuestionBatch: vi.fn(),
}));

it("opens progress only after import is clicked and allows retry after failure", async () => {
    let rejectImport!: (error: Error) => void;
    vi.mocked(ingestQuestionBatch).mockImplementation(
        () =>
            new Promise((_, reject) => {
                rejectImport = reject;
            }),
    );
    const user = userEvent.setup();
    renderAt("/quizzes/import");
    const file = new File(["{}"], "quiz.json", { type: "application/json" });
    Object.defineProperty(file, "text", {
        value: () =>
            Promise.resolve(
                JSON.stringify({
                    title: "Geography",
                    questions: [{ prompt: "Capital of France?", answer: "Paris" }],
                }),
            ),
    });
    await user.upload(await screen.findByLabelText("Quiz JSON file"), file);
    expect(await screen.findByRole("heading", { name: "Geography" })).toBeVisible();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Import quiz" }));
    const dialog = screen.getByRole("dialog", { name: "Importing quiz" });
    expect(within(dialog).getByRole("status")).toHaveTextContent("Importing questions…");
    expect(within(dialog).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    await act(() => Promise.resolve(rejectImport(new Error("Connection lost"))));
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Connection lost");
    await user.click(within(dialog).getByRole("button", { name: "Retry import" }));
    expect(ingestQuestionBatch).toHaveBeenCalledTimes(2);
    expect(within(dialog).getByRole("progressbar")).toBeVisible();
    await act(() => Promise.resolve(rejectImport(new Error("Still offline"))));
    await user.click(within(dialog).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import quiz" })).toHaveFocus();
});
