import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../api/questions";
import { renderAt } from "../test/render-route";
import { question, questionId, tag, timestamp } from "../test/domain-fixtures";
vi.mock("../api/questions", () => ({
    listManagedQuestions: vi.fn(),
    getQuestion: vi.fn(),
    createQuestion: vi.fn(),
    saveQuestionContent: vi.fn(),
    listTags: vi.fn(),
    createTag: vi.fn(),
    assignQuestionTag: vi.fn(),
    removeQuestionTag: vi.fn(),
}));
beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.listManagedQuestions).mockResolvedValue({ items: [question], nextOffset: null });
    vi.mocked(api.getQuestion).mockResolvedValue(question);
    vi.mocked(api.listTags).mockResolvedValue([tag]);
});
it("lists personal questions with prompt search, tags, and pagination", async () => {
    const user = userEvent.setup();
    vi.mocked(api.listManagedQuestions).mockImplementation(({ offset }) =>
        Promise.resolve({
            items: offset ? [{ ...question, prompt: "Next page" }] : [question],
            nextOffset: offset ? null : 50,
        }),
    );
    renderAt("/questions/mine");
    expect(await screen.findByRole("heading", { name: "My questions" })).toBeVisible();
    expect(await screen.findByRole("link", { name: question.prompt })).toBeVisible();
    await user.type(screen.getByLabelText("Search prompts"), "missing");
    expect(screen.queryByRole("link", { name: question.prompt })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("Search prompts"));
    await user.selectOptions(screen.getByLabelText("Tag"), tag.slug);
    await waitFor(() =>
        expect(api.listManagedQuestions).toHaveBeenCalledWith({ offset: 0, tag: tag.slug }),
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("link", { name: "Next page" })).toBeVisible();
});
it("creates private questions without access selectors", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createQuestion).mockResolvedValue(question);
    renderAt("/questions/new");
    await user.type(await screen.findByLabelText("Question prompt"), question.prompt);
    await user.type(screen.getByLabelText("One answer per line"), "Paris");
    await user.click(screen.getByRole("button", { name: "Create question" }));
    await waitFor(() => expect(api.createQuestion).toHaveBeenCalled());
    expect(vi.mocked(api.createQuestion).mock.calls[0]?.[0].content.prompt).toBe(question.prompt);
    expect(Object.keys(vi.mocked(api.createQuestion).mock.calls[0]?.[0] ?? {})).toEqual([
        "content",
    ]);
    expect(screen.queryByLabelText("Visibility")).not.toBeInTheDocument();
});
it("edits unused direct content and preserves owner tagging", async () => {
    const user = userEvent.setup();
    vi.mocked(api.saveQuestionContent).mockResolvedValue({
        ...question,
        prompt: "Changed",
        updatedAt: "2026-10-13T01:00:00.000Z",
    });
    vi.mocked(api.assignQuestionTag).mockResolvedValue({ ...question, tags: [tag] });
    renderAt(`/questions/${questionId}`);
    const prompt = await screen.findByLabelText("Question prompt");
    await user.clear(prompt);
    await user.type(prompt, "Changed");
    await user.click(screen.getByRole("button", { name: "Save question" }));
    await waitFor(() =>
        expect(api.saveQuestionContent).toHaveBeenCalledWith(
            questionId,
            expect.objectContaining({ prompt: "Changed" }),
        ),
    );
    await user.selectOptions(screen.getByLabelText("Tag to add"), tag.id);
    await user.click(screen.getByRole("button", { name: "Add tag" }));
    await waitFor(() => expect(api.assignQuestionTag).toHaveBeenCalledWith(questionId, tag.id));
    expect(screen.queryByText("Version history")).not.toBeInTheDocument();
});
it("explains permanent locks and keeps tags editable", async () => {
    vi.mocked(api.getQuestion).mockResolvedValue({
        ...question,
        contentLockedAt: timestamp,
        canEditContent: false,
    });
    renderAt(`/questions/${questionId}`);
    expect(await screen.findByText(/permanently locked/)).toBeVisible();
    expect(screen.queryByLabelText("Question prompt")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tag to add")).toBeVisible();
    expect(screen.getByRole("link", { name: "New question" })).toBeVisible();
});
it("shows public question content without owner editing controls", async () => {
    vi.mocked(api.getQuestion).mockResolvedValue({
        ...question,
        visibility: "public",
        isOwner: false,
        canEditContent: false,
    });
    renderAt(`/questions/${questionId}`);
    expect(await screen.findByRole("heading", { name: question.prompt })).toBeVisible();
    expect(screen.queryByLabelText("Question prompt")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Tag to add")).not.toBeInTheDocument();
    expect(screen.getByText("Public question content is read-only.")).toBeVisible();
});
