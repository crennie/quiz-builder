import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { render, screen } from "@testing-library/react";
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
    await user.click(screen.getByRole("button", { name: "Create quiz" }));
    const submitted = vi.mocked(quizzesApi.createQuiz).mock.calls[0]?.[0];
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
