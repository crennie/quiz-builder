import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as questionsApi from "../api/questions";
import * as quizzesApi from "../api/quizzes";
import * as attemptsApi from "../api/attempts";
import { router } from "../app/router";
import { createQueryClient } from "../app/query-client";
import { AuthContext } from "../auth/auth-state";

vi.mock("../api/questions", () => ({
    listQuestions: vi.fn(),
    getQuestionVersions: vi.fn(),
    listTags: vi.fn(),
}));
vi.mock("../api/quizzes", () => ({
    listQuizzes: vi.fn(),
    getQuiz: vi.fn(),
    getQuizVersions: vi.fn(),
    createQuiz: vi.fn(),
    saveQuizContent: vi.fn(),
    updateQuizMetadata: vi.fn(),
    assignQuizTag: vi.fn(),
    removeQuizTag: vi.fn(),
}));
vi.mock("../api/attempts", () => ({
    listAttempts: vi.fn(),
    startAttempt: vi.fn(),
}));

const ownerId = "123e4567-e89b-42d3-a456-426614174030";
const questionId = "223e4567-e89b-42d3-a456-426614174030";
const questionVersionId = "323e4567-e89b-42d3-a456-426614174030";
const quizId = "423e4567-e89b-42d3-a456-426614174030";
const quizVersionId = "523e4567-e89b-42d3-a456-426614174030";
const membershipId = "623e4567-e89b-42d3-a456-426614174030";
const timestamp = "2026-09-28T00:00:00.000Z";
const questionVersion = {
    id: questionVersionId,
    versionNumber: 2,
    createdBy: ownerId,
    createdAt: timestamp,
    prompt: "Capital of France?",
    questionType: "exact_text" as const,
    answerConfig: { questionType: "exact_text" as const, acceptedAnswers: ["Paris"] },
    gradingConfig: {
        questionType: "exact_text" as const,
        caseSensitive: false,
        trimWhitespace: true,
    },
    explanation: null,
};
const question = {
    id: questionId,
    createdBy: ownerId,
    visibility: "private" as const,
    status: "published" as const,
    createdAt: timestamp,
    updatedAt: timestamp,
    tags: [],
    isOwner: true,
    currentVersion: questionVersion,
};
const quiz = {
    id: quizId,
    createdBy: ownerId,
    visibility: "private" as const,
    status: "draft" as const,
    createdAt: timestamp,
    updatedAt: timestamp,
    tags: [],
    isOwner: true,
    currentVersion: {
        id: quizVersionId,
        versionNumber: 1,
        title: "Geography practice",
        description: null,
        settings: { shuffleQuestions: false, showAnswersAfterCompletion: true },
        questions: [
            {
                id: membershipId,
                position: 0,
                questionId,
                questionVersionId,
                points: 1,
                required: true,
                timeLimitSeconds: null,
                question: {
                    prompt: questionVersion.prompt,
                    questionType: questionVersion.questionType,
                    answerConfig: questionVersion.answerConfig,
                    gradingConfig: questionVersion.gradingConfig,
                    explanation: null,
                },
            },
        ],
        createdBy: ownerId,
        createdAt: timestamp,
    },
};

function renderAt(path: string) {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const testRouter = createRouter({
        routeTree: router.routeTree,
        history: createMemoryHistory({ initialEntries: [path] }),
    });
    return render(
        <QueryClientProvider client={createQueryClient()}>
            <AuthContext.Provider
                value={{
                    session: { user: { id: ownerId } } as Session,
                    loading: false,
                    configured: true,
                }}
            >
                <RouterProvider router={testRouter} />
            </AuthContext.Provider>
        </QueryClientProvider>,
    );
}

beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(quizzesApi.listQuizzes).mockResolvedValue({ items: [quiz], nextOffset: null });
    vi.mocked(quizzesApi.getQuiz).mockResolvedValue(quiz);
    vi.mocked(quizzesApi.getQuizVersions).mockResolvedValue({ versions: [quiz.currentVersion] });
    vi.mocked(questionsApi.listQuestions).mockResolvedValue({
        items: [question],
        nextOffset: null,
    });
    vi.mocked(questionsApi.getQuestionVersions).mockResolvedValue({ versions: [questionVersion] });
    vi.mocked(questionsApi.listTags).mockResolvedValue([]);
    vi.mocked(attemptsApi.listAttempts).mockResolvedValue({ items: [], nextOffset: null });
});

it("lists quizzes and opens an owned quiz", async () => {
    const user = userEvent.setup();
    renderAt("/quizzes");
    await user.click(await screen.findByRole("link", { name: "Geography practice" }));
    expect(await screen.findByRole("heading", { name: "Edit quiz content" })).toBeInTheDocument();
});

it("keeps the current version on a no-op save, then saves changed content", async () => {
    const user = userEvent.setup();
    vi.mocked(quizzesApi.saveQuizContent).mockResolvedValue(quiz);
    renderAt(`/quizzes/${quizId}`);
    await screen.findByRole("heading", { name: "Edit quiz content" });
    await user.click(screen.getByRole("button", { name: "Save quiz" }));
    expect(
        screen.getByText("No changes to save. The current version was kept."),
    ).toBeInTheDocument();
    expect(quizzesApi.saveQuizContent).not.toHaveBeenCalled();

    await user.clear(screen.getByRole("textbox", { name: "Quiz title" }));
    await user.type(screen.getByRole("textbox", { name: "Quiz title" }), "World capitals");
    await user.click(screen.getByRole("button", { name: "Save quiz" }));
    expect(quizzesApi.saveQuizContent).toHaveBeenCalledWith(
        quizId,
        expect.objectContaining({
            title: "World capitals",
            questions: [expect.objectContaining({ questionVersionId })],
        }),
    );
});

it("creates a quiz with an explicitly selected question version and scoring", async () => {
    const user = userEvent.setup();
    vi.mocked(quizzesApi.createQuiz).mockResolvedValue(quiz);
    renderAt("/quizzes/new");
    await user.type(
        await screen.findByRole("textbox", { name: "Quiz title" }),
        "Geography practice",
    );
    await user.click(screen.getByRole("button", { name: "Add question" }));
    await user.click(await screen.findByRole("button", { name: "Capital of France?" }));
    await user.click(
        await screen.findByRole("button", { name: "Select version 2: Capital of France?" }),
    );
    await user.clear(screen.getByRole("spinbutton", { name: "Points for question 1" }));
    await user.type(screen.getByRole("spinbutton", { name: "Points for question 1" }), "2.5");
    await user.selectOptions(screen.getByRole("combobox", { name: "Visibility" }), "unlisted");
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "published");
    await user.click(screen.getByRole("button", { name: "Create quiz" }));
    const submitted = vi.mocked(quizzesApi.createQuiz).mock.calls[0]?.[0];
    expect(submitted).toMatchObject({ visibility: "unlisted", status: "published" });
    expect(submitted?.content.questions[0]).toEqual({
        questionId,
        questionVersionId,
        points: 2.5,
        required: true,
        timeLimitSeconds: null,
    });
});

it("updates a pinned question version while keeping its scoring", async () => {
    const user = userEvent.setup();
    const oldVersionId = "723e4567-e89b-42d3-a456-426614174030";
    vi.mocked(quizzesApi.getQuiz).mockResolvedValue({
        ...quiz,
        currentVersion: {
            ...quiz.currentVersion,
            questions: [
                {
                    ...quiz.currentVersion.questions[0]!,
                    questionVersionId: oldVersionId,
                    points: 3,
                },
            ],
        },
    });
    vi.mocked(quizzesApi.saveQuizContent).mockResolvedValue(quiz);
    renderAt(`/quizzes/${quizId}`);
    await screen.findByRole("heading", { name: "Edit quiz content" });
    await user.click(screen.getByRole("button", { name: "Change question or version" }));
    await user.click(await screen.findByRole("button", { name: "Capital of France?" }));
    await user.click(
        await screen.findByRole("button", { name: "Select version 2: Capital of France?" }),
    );
    await user.click(screen.getByRole("button", { name: "Save quiz" }));
    const saved = vi.mocked(quizzesApi.saveQuizContent).mock.calls[0]?.[1];
    expect(saved?.questions[0]).toEqual({
        questionId,
        questionVersionId,
        points: 3,
        required: true,
        timeLimitSeconds: null,
    });
});

it("filters quiz cards by owner, title, and tag while paging", async () => {
    const user = userEvent.setup();
    const publicQuiz = {
        ...quiz,
        id: "823e4567-e89b-42d3-a456-426614174030",
        isOwner: false,
        currentVersion: { ...quiz.currentVersion, title: "Public science" },
    };
    vi.mocked(quizzesApi.listQuizzes).mockImplementation(({ offset, scope }) =>
        Promise.resolve({
            items: offset === 0 ? (scope === "mine" ? [quiz] : [publicQuiz, quiz]) : [],
            nextOffset: offset === 0 ? 50 : null,
        }),
    );
    vi.mocked(questionsApi.listTags).mockResolvedValue([
        {
            id: "923e4567-e89b-42d3-a456-426614174030",
            name: "Science",
            slug: "science",
            createdAt: timestamp,
        },
    ]);
    renderAt("/quizzes");
    expect(await screen.findByRole("link", { name: "Geography practice" })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Show" }), "mine");
    expect(screen.queryByRole("link", { name: "Public science" })).not.toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Search titles" }), "missing");
    expect(screen.getByText("No quizzes match these filters.")).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Search titles" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Tag" }), "science");
    await waitFor(() =>
        expect(quizzesApi.listQuizzes).toHaveBeenCalledWith({
            tag: "science",
            scope: "mine",
            offset: 0,
        }),
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
        expect(quizzesApi.listQuizzes).toHaveBeenCalledWith({
            tag: "science",
            scope: "mine",
            offset: 50,
        }),
    );
    expect(screen.getByText("No quizzes match these filters.")).toBeInTheDocument();
});

it("requests an owner-only page when showing My quizzes", async () => {
    const user = userEvent.setup();
    const publicQuiz = {
        ...quiz,
        id: "823e4567-e89b-42d3-a456-426614174030",
        isOwner: false,
        currentVersion: { ...quiz.currentVersion, title: "New public quiz" },
    };
    vi.mocked(quizzesApi.listQuizzes).mockImplementation(({ scope }) =>
        Promise.resolve(
            scope === "mine"
                ? { items: [quiz], nextOffset: null }
                : { items: [publicQuiz], nextOffset: 50 },
        ),
    );
    renderAt("/quizzes");
    expect(await screen.findByRole("link", { name: "New public quiz" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(quizzesApi.listQuizzes).toHaveBeenCalledWith({ offset: 50 }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Show" }), "mine");
    expect(await screen.findByRole("link", { name: "Geography practice" })).toBeInTheDocument();
    expect(quizzesApi.listQuizzes).toHaveBeenCalledWith({ scope: "mine", offset: 0 });
});

it("shows a loading state while the quiz library is pending", async () => {
    vi.mocked(quizzesApi.listQuizzes).mockReturnValue(new Promise(() => {}));
    renderAt("/quizzes");
    expect(await screen.findByText("Loading quizzes…")).toBeInTheDocument();
});

it("saves settings, required state, and suggested time, then removes a question", async () => {
    const user = userEvent.setup();
    vi.mocked(quizzesApi.saveQuizContent).mockResolvedValue(quiz);
    renderAt(`/quizzes/${quizId}`);
    await screen.findByRole("heading", { name: "Edit quiz content" });
    await user.click(screen.getByRole("checkbox", { name: "Shuffle questions for each attempt" }));
    await user.click(screen.getByRole("checkbox", { name: "Show answers after completion" }));
    await user.click(screen.getByRole("checkbox", { name: "Required" }));
    await user.type(
        screen.getByRole("spinbutton", { name: "Time limit in seconds for question 1" }),
        "45",
    );
    await user.click(screen.getByRole("button", { name: "Save quiz" }));
    expect(quizzesApi.saveQuizContent).toHaveBeenCalledWith(
        quizId,
        expect.objectContaining({
            settings: { shuffleQuestions: true, showAnswersAfterCompletion: false },
            questions: [expect.objectContaining({ required: false, timeLimitSeconds: 45 })],
        }),
    );
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await user.click(screen.getByRole("button", { name: "Save quiz" }));
    expect(vi.mocked(quizzesApi.saveQuizContent).mock.calls.at(-1)?.[1].questions).toEqual([]);
});

it("reorders saved quiz questions", async () => {
    const user = userEvent.setup();
    const secondQuestionId = "a23e4567-e89b-42d3-a456-426614174030";
    const secondVersionId = "b23e4567-e89b-42d3-a456-426614174030";
    vi.mocked(quizzesApi.getQuiz).mockResolvedValue({
        ...quiz,
        currentVersion: {
            ...quiz.currentVersion,
            questions: [
                quiz.currentVersion.questions[0]!,
                {
                    ...quiz.currentVersion.questions[0]!,
                    id: "c23e4567-e89b-42d3-a456-426614174030",
                    position: 1,
                    questionId: secondQuestionId,
                    questionVersionId: secondVersionId,
                    question: {
                        ...quiz.currentVersion.questions[0]!.question,
                        prompt: "Second question",
                    },
                },
            ],
        },
    });
    vi.mocked(quizzesApi.saveQuizContent).mockResolvedValue(quiz);
    renderAt(`/quizzes/${quizId}`);
    const questions = await screen.findByRole("region", { name: "Quiz questions" });
    await user.click(within(questions).getAllByRole("button", { name: "Move down" })[0]!);
    await user.click(screen.getByRole("button", { name: "Save quiz" }));
    expect(
        vi.mocked(quizzesApi.saveQuizContent).mock.calls[0]?.[1].questions.map((q) => q.questionId),
    ).toEqual([secondQuestionId, questionId]);
});

it("shows owner version history and updates quiz metadata and tags", async () => {
    const user = userEvent.setup();
    const tag = {
        id: "923e4567-e89b-42d3-a456-426614174030",
        name: "Science",
        slug: "science",
        createdAt: timestamp,
    };
    const extraTag = {
        id: "d23e4567-e89b-42d3-a456-426614174030",
        name: "Practice",
        slug: "practice",
        createdAt: timestamp,
    };
    vi.mocked(questionsApi.listTags).mockResolvedValue([tag, extraTag]);
    vi.mocked(quizzesApi.getQuiz).mockResolvedValue({ ...quiz, tags: [tag] });
    vi.mocked(quizzesApi.updateQuizMetadata).mockResolvedValue(quiz);
    vi.mocked(quizzesApi.removeQuizTag).mockResolvedValue(undefined);
    vi.mocked(quizzesApi.assignQuizTag).mockResolvedValue(quiz);
    renderAt(`/quizzes/${quizId}`);
    expect(await screen.findByRole("heading", { name: "Version history" })).toBeInTheDocument();
    expect(await screen.findByText("Version 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Science tag" }));
    expect(quizzesApi.removeQuizTag).toHaveBeenCalledWith(quizId, tag.id);
    await user.selectOptions(screen.getByRole("combobox", { name: "Tag to add" }), extraTag.id);
    await user.click(screen.getByRole("button", { name: "Add tag" }));
    expect(quizzesApi.assignQuizTag).toHaveBeenCalledWith(quizId, extraTag.id);
    await user.selectOptions(screen.getByRole("combobox", { name: "Visibility" }), "unlisted");
    await waitFor(() =>
        expect(quizzesApi.updateQuizMetadata).toHaveBeenCalledWith(quizId, {
            visibility: "unlisted",
        }),
    );
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "archived");
    await waitFor(() =>
        expect(quizzesApi.updateQuizMetadata).toHaveBeenCalledWith(quizId, { status: "archived" }),
    );
});

it("searches and pages through the question picker before choosing a version", async () => {
    const user = userEvent.setup();
    vi.mocked(questionsApi.listQuestions).mockImplementation(({ offset }) =>
        Promise.resolve({ items: [question], nextOffset: offset === 0 ? 50 : null }),
    );
    vi.mocked(questionsApi.listTags).mockResolvedValue([
        {
            id: "923e4567-e89b-42d3-a456-426614174030",
            name: "Science",
            slug: "science",
            createdAt: timestamp,
        },
    ]);
    renderAt(`/quizzes/${quizId}`);
    await user.click(await screen.findByRole("button", { name: "Add question" }));
    await user.type(screen.getByRole("searchbox", { name: "Search prompts" }), "missing");
    expect(screen.queryByRole("button", { name: "Capital of France?" })).not.toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Search prompts" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Tag" }), "science");
    await waitFor(() =>
        expect(questionsApi.listQuestions).toHaveBeenCalledWith({ tag: "science", offset: 0 }),
    );
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() =>
        expect(questionsApi.listQuestions).toHaveBeenCalledWith({ tag: "science", offset: 50 }),
    );
    await user.click(screen.getByRole("button", { name: "Capital of France?" }));
    expect(
        await screen.findByRole("button", { name: "Select version 2: Capital of France?" }),
    ).toBeInTheDocument();
});

it("lets an owner pin an older question version", async () => {
    const user = userEvent.setup();
    const oldId = "e23e4567-e89b-42d3-a456-426614174030";
    vi.mocked(questionsApi.getQuestionVersions).mockResolvedValue({
        versions: [
            questionVersion,
            { ...questionVersion, id: oldId, versionNumber: 1, prompt: "Earlier wording?" },
        ],
    });
    vi.mocked(quizzesApi.createQuiz).mockResolvedValue(quiz);
    renderAt("/quizzes/new");
    await user.type(await screen.findByRole("textbox", { name: "Quiz title" }), "Study");
    await user.click(screen.getByRole("button", { name: "Add question" }));
    await user.click(await screen.findByRole("button", { name: "Capital of France?" }));
    await user.click(
        await screen.findByRole("button", { name: "Select version 1: Earlier wording?" }),
    );
    await user.click(screen.getByRole("button", { name: "Create quiz" }));
    expect(
        vi.mocked(quizzesApi.createQuiz).mock.calls[0]?.[0].content.questions[0]?.questionVersionId,
    ).toBe(oldId);
});

it("offers only the current version of another author's public question", async () => {
    const user = userEvent.setup();
    vi.mocked(questionsApi.listQuestions).mockResolvedValue({
        items: [{ ...question, isOwner: false, visibility: "public" }],
        nextOffset: null,
    });
    renderAt("/quizzes/new");
    await user.click(await screen.findByRole("button", { name: "Add question" }));
    await user.click(await screen.findByRole("button", { name: "Capital of France?" }));
    expect(
        await screen.findByRole("button", { name: "Select version 2: Capital of France?" }),
    ).toBeInTheDocument();
    expect(questionsApi.getQuestionVersions).not.toHaveBeenCalled();
});
