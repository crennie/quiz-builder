import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { QuestionVersionContent } from "@quiz-builder/contracts";

import { QuestionEditor } from "./question-editor";

describe("QuestionEditor", () => {
    it("builds exact-text content with compatible grading settings", async () => {
        const user = userEvent.setup();
        const onSave = vi
            .fn<(content: QuestionVersionContent) => Promise<void>>()
            .mockResolvedValue(undefined);
        render(<QuestionEditor submitLabel="Save" busy={false} onSave={onSave} />);
        await user.type(
            screen.getByRole("textbox", { name: "Question prompt" }),
            "Capital of France?",
        );
        await user.type(
            screen.getByRole("textbox", { name: "One answer per line" }),
            "Paris\nPARIS",
        );
        await user.click(screen.getByRole("checkbox", { name: "Case sensitive" }));
        await user.click(screen.getByRole("button", { name: "Save" }));
        expect(onSave).toHaveBeenCalledWith(
            expect.objectContaining({
                questionType: "exact_text",
                answerConfig: { questionType: "exact_text", acceptedAnswers: ["Paris", "PARIS"] },
                gradingConfig: {
                    questionType: "exact_text",
                    caseSensitive: true,
                    trimWhitespace: true,
                },
            }),
        );
    });

    it("creates a single-choice answer and validates a missing correct choice", async () => {
        const user = userEvent.setup();
        const onSave = vi
            .fn<(content: QuestionVersionContent) => Promise<void>>()
            .mockResolvedValue(undefined);
        render(<QuestionEditor submitLabel="Save" busy={false} onSave={onSave} />);
        await user.type(screen.getByRole("textbox", { name: "Question prompt" }), "Choose one");
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Question type" }),
            "multiple_choice_single",
        );
        await user.type(screen.getByRole("textbox", { name: "Choice 1" }), "A");
        await user.type(screen.getByRole("textbox", { name: "Choice 2" }), "B");
        await user.click(screen.getByRole("button", { name: "Save" }));
        expect(screen.getByRole("alert")).toHaveTextContent("correct answer");
        expect(onSave).not.toHaveBeenCalled();
        await user.click(screen.getAllByRole("radio", { name: "Correct" })[1]!);
        await user.click(screen.getByRole("button", { name: "Save" }));
        expect(onSave.mock.calls[0]?.[0]).toMatchObject({
            questionType: "multiple_choice_single",
            answerConfig: { correctOptionId: "b" },
        });
    });

    it("allows several correct choices for multi-choice questions", async () => {
        const user = userEvent.setup();
        const onSave = vi
            .fn<(content: QuestionVersionContent) => Promise<void>>()
            .mockResolvedValue(undefined);
        render(<QuestionEditor submitLabel="Save" busy={false} onSave={onSave} />);
        await user.type(screen.getByRole("textbox", { name: "Question prompt" }), "Choose both");
        await user.selectOptions(
            screen.getByRole("combobox", { name: "Question type" }),
            "multiple_choice_multi",
        );
        await user.type(screen.getByRole("textbox", { name: "Choice 1" }), "A");
        await user.type(screen.getByRole("textbox", { name: "Choice 2" }), "B");
        for (const checkbox of screen.getAllByRole("checkbox", { name: "Correct" }))
            await user.click(checkbox);
        await user.click(screen.getByRole("button", { name: "Save" }));
        expect(onSave.mock.calls[0]?.[0]).toMatchObject({
            questionType: "multiple_choice_multi",
            answerConfig: { correctOptionIds: ["a", "b"] },
        });
    });
});
