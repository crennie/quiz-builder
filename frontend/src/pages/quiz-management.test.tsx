import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as api from "../api/quizzes";
import * as questions from "../api/questions";
import * as attempts from "../api/attempts";
import { renderAt } from "../test/render-route";
import { quiz, quizId, question, tag } from "../test/domain-fixtures";
vi.mock("../api/quizzes", () => ({
    listQuizzes: vi.fn(),
    getQuiz: vi.fn(),
    createQuiz: vi.fn(),
    saveQuizContent: vi.fn(),
    assignQuizTag: vi.fn(),
    removeQuizTag: vi.fn(),
}));
vi.mock("../api/questions", () => ({
    listManagedQuestions: vi.fn(),
    getQuestion: vi.fn(),
    listTags: vi.fn(),
}));
vi.mock("../api/attempts", () => ({ listAttempts: vi.fn(), startAttempt: vi.fn() }));
beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(api.getQuiz).mockResolvedValue(quiz);
    vi.mocked(api.listQuizzes).mockResolvedValue({ items: [quiz], nextOffset: null });
    vi.mocked(questions.listManagedQuestions).mockResolvedValue({
        items: [question],
        nextOffset: null,
    });
    vi.mocked(questions.getQuestion).mockResolvedValue(question);
    vi.mocked(questions.listTags).mockResolvedValue([tag]);
    vi.mocked(attempts.listAttempts).mockResolvedValue({ items: [], nextOffset: null });
});
it("creates private quizzes with direct question IDs and scoring settings", async () => {
    const user = userEvent.setup();
    vi.mocked(api.createQuiz).mockResolvedValue(quiz);
    renderAt("/quizzes/new");
    await user.type(await screen.findByLabelText("Quiz title"), "Practice");
    await user.click(screen.getByRole("button", { name: "Add question" }));
    await user.click(await screen.findByRole("button", { name: question.prompt }));
    await user.clear(screen.getByLabelText("Points for question 1"));
    await user.type(screen.getByLabelText("Points for question 1"), "2.5");
    await user.type(screen.getByLabelText("Time limit in seconds for question 1"), "30");
    await user.click(screen.getByRole("button", { name: "Create quiz" }));
    await waitFor(() => expect(api.createQuiz).toHaveBeenCalled());
    expect(vi.mocked(api.createQuiz).mock.calls[0]?.[0].content).toMatchObject({
        title: "Practice",
        questions: [{ questionId: question.id, points: 2.5, required: true, timeLimitSeconds: 30 }],
    });
    expect(Object.keys(vi.mocked(api.createQuiz).mock.calls[0]?.[0] ?? {})).toEqual(["content"]);
    expect(screen.queryByLabelText("Visibility")).not.toBeInTheDocument();
});
it("keeps equivalent saves harmless and saves changed title and composition", async () => {
    const user = userEvent.setup();
    vi.mocked(api.saveQuizContent).mockResolvedValue(quiz);
    renderAt(`/quizzes/${quizId}`);
    await user.click(await screen.findByRole("button", { name: "Save quiz" }));
    expect(await screen.findByText("No changes to save.")).toBeVisible();
    expect(api.saveQuizContent).not.toHaveBeenCalled();
    await user.clear(screen.getByLabelText("Quiz title"));
    await user.type(screen.getByLabelText("Quiz title"), "Changed");
    await user.click(screen.getByRole("button", { name: "Add question" }));
    await user.click(await screen.findByRole("button", { name: question.prompt }));
    await user.click(screen.getAllByRole("button", { name: "Move up" })[1]!);
    await user.click(screen.getByRole("button", { name: "Save quiz" }));
    await waitFor(() => expect(api.saveQuizContent).toHaveBeenCalled());
    expect(vi.mocked(api.saveQuizContent).mock.calls[0]?.[1].title).toBe("Changed");
    expect(
        vi.mocked(api.saveQuizContent).mock.calls[0]?.[1].questions.map((q) => q.questionId),
    ).toEqual([question.id, question.id]);
});
it("adds an accessible public question by known ID", async () => {
    const user = userEvent.setup();
    vi.mocked(questions.getQuestion).mockResolvedValue({
        ...question,
        visibility: "public",
        isOwner: false,
        canEditContent: false,
    });
    renderAt("/quizzes/new");
    await user.click(await screen.findByRole("button", { name: "Add question" }));
    await user.type(screen.getByLabelText("Public question ID"), question.id);
    await user.click(screen.getByRole("button", { name: "Add by ID" }));
    expect(await screen.findByText(question.prompt)).toBeVisible();
    expect(questions.getQuestion).toHaveBeenCalledWith(question.id);
});
it("disables attempted quiz editing while preserving taking and tagging", async () => {
    vi.mocked(api.getQuiz).mockResolvedValue({ ...quiz, canEditContent: false });
    renderAt(`/quizzes/${quizId}`);
    expect(
        await screen.findByText(/After an attempt, changes require a new quiz record/),
    ).toBeVisible();
    expect(screen.queryByLabelText("Quiz title")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Start new attempt" })).toBeEnabled();
    expect(screen.getByLabelText("Tag to add")).toBeVisible();
});
it("filters quiz lists by owner scope", async () => {
    const user = userEvent.setup();
    renderAt("/quizzes");
    expect(await screen.findByRole("link", { name: quiz.title })).toBeVisible();
    await user.selectOptions(screen.getByLabelText("Show"), "mine");
    await waitFor(() => expect(api.listQuizzes).toHaveBeenCalledWith({ scope: "mine", offset: 0 }));
});
