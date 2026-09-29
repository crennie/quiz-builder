import type { AttemptDetail, Feedback, QuizDetail, UserResponse } from "@quiz-builder/contracts";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as attemptsApi from "../api/attempts";
import * as feedbackApi from "../api/feedback";
import * as questionsApi from "../api/questions";
import * as quizzesApi from "../api/quizzes";
import { createQueryClient } from "../app/query-client";
import { router } from "../app/router";
import { AuthContext } from "../auth/auth-state";

vi.mock("../api/attempts", () => ({
    listAttempts: vi.fn(),
    getAttempt: vi.fn(),
    startAttempt: vi.fn(),
    submitAnswer: vi.fn(),
    completeAttempt: vi.fn(),
}));
vi.mock("../api/feedback", () => ({ createFeedback: vi.fn() }));
vi.mock("../api/questions", () => ({ listTags: vi.fn() }));
vi.mock("../api/quizzes", () => ({
    getQuiz: vi.fn(),
    getQuizVersions: vi.fn(),
    listQuizzes: vi.fn(),
    updateQuizMetadata: vi.fn(),
    saveQuizContent: vi.fn(),
    assignQuizTag: vi.fn(),
    removeQuizTag: vi.fn(),
}));

const ownerId = "123e4567-e89b-42d3-a456-426614174030";
const learnerId = "223e4567-e89b-42d3-a456-426614174030";
const quizId = "323e4567-e89b-42d3-a456-426614174030";
const quizVersionId = "423e4567-e89b-42d3-a456-426614174030";
const attemptId = "523e4567-e89b-42d3-a456-426614174030";
const timestamp = "2026-09-28T00:00:00.000Z";
const ids = [
    "623e4567-e89b-42d3-a456-426614174030",
    "723e4567-e89b-42d3-a456-426614174030",
    "823e4567-e89b-42d3-a456-426614174030",
];
const options = [
    { id: "paris", text: "Paris" },
    { id: "london", text: "London" },
];
const multiOptions = [
    { id: "red", text: "Red" },
    { id: "blue", text: "Blue" },
    { id: "green", text: "Green" },
];
const quiz: QuizDetail = {
    id: quizId,
    createdBy: ownerId,
    visibility: "public",
    status: "published",
    createdAt: timestamp,
    updatedAt: timestamp,
    tags: [],
    isOwner: false,
    currentVersion: {
        id: quizVersionId,
        versionNumber: 1,
        title: "World capitals",
        description: "Practice geography",
        settings: { shuffleQuestions: false, showAnswersAfterCompletion: true },
        questions: [
            {
                id: ids[0]!,
                position: 0,
                questionId: ids[0]!,
                questionVersionId: ids[0]!,
                points: 1,
                required: true,
                timeLimitSeconds: null,
                question: {
                    prompt: "Capital of France?",
                    questionType: "exact_text",
                    answerConfig: { questionType: "exact_text", acceptedAnswers: ["Paris"] },
                    gradingConfig: {
                        questionType: "exact_text",
                        caseSensitive: false,
                        trimWhitespace: true,
                    },
                    explanation: null,
                },
            },
            {
                id: ids[1]!,
                position: 1,
                questionId: ids[1]!,
                questionVersionId: ids[1]!,
                points: 1,
                required: true,
                timeLimitSeconds: null,
                question: {
                    prompt: "Capital of England?",
                    questionType: "multiple_choice_single",
                    answerConfig: {
                        questionType: "multiple_choice_single",
                        options,
                        correctOptionId: "london",
                    },
                    gradingConfig: { questionType: "multiple_choice_single" },
                    explanation: null,
                },
            },
            {
                id: ids[2]!,
                position: 2,
                questionId: ids[2]!,
                questionVersionId: ids[2]!,
                points: 1,
                required: true,
                timeLimitSeconds: null,
                question: {
                    prompt: "Primary colors?",
                    questionType: "multiple_choice_multi",
                    answerConfig: {
                        questionType: "multiple_choice_multi",
                        options: multiOptions,
                        correctOptionIds: ["red", "blue"],
                    },
                    gradingConfig: { questionType: "multiple_choice_multi" },
                    explanation: null,
                },
            },
        ],
        createdBy: ownerId,
        createdAt: timestamp,
    },
};

function initialAttempt(): AttemptDetail {
    return {
        id: attemptId,
        quizId,
        quizVersionId,
        quizTitle: "World capitals",
        status: "in_progress",
        startedAt: timestamp,
        completedAt: null,
        settings: { shuffleQuestions: false, showAnswersAfterCompletion: true },
        scoreSummary: null,
        questions: [
            {
                id: ids[0]!,
                position: 0,
                prompt: "Capital of France?",
                questionType: "exact_text",
                options: null,
                required: true,
                timeLimitSeconds: null,
                pointsPossible: 1,
                userResponse: null,
                pointsAwarded: null,
                evaluationResult: null,
                correctAnswer: null,
                explanation: null,
                answeredAt: null,
            },
            {
                id: ids[1]!,
                position: 1,
                prompt: "Capital of England?",
                questionType: "multiple_choice_single",
                options,
                required: true,
                timeLimitSeconds: null,
                pointsPossible: 1,
                userResponse: null,
                pointsAwarded: null,
                evaluationResult: null,
                correctAnswer: null,
                explanation: null,
                answeredAt: null,
            },
            {
                id: ids[2]!,
                position: 2,
                prompt: "Primary colors?",
                questionType: "multiple_choice_multi",
                options: multiOptions,
                required: true,
                timeLimitSeconds: null,
                pointsPossible: 1,
                userResponse: null,
                pointsAwarded: null,
                evaluationResult: null,
                correctAnswer: null,
                explanation: null,
                answeredAt: null,
            },
        ],
    };
}

let currentAttempt: AttemptDetail;
let started: boolean;

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
                    session: { user: { id: learnerId } } as Session,
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
    currentAttempt = initialAttempt();
    started = false;
    vi.mocked(quizzesApi.getQuiz).mockResolvedValue(quiz);
    vi.mocked(questionsApi.listTags).mockResolvedValue([]);
    vi.mocked(attemptsApi.listAttempts).mockImplementation(() =>
        Promise.resolve({ items: started ? [currentAttempt] : [], nextOffset: null }),
    );
    vi.mocked(attemptsApi.getAttempt).mockImplementation(() => Promise.resolve(currentAttempt));
    vi.mocked(attemptsApi.startAttempt).mockImplementation(() => {
        started = true;
        return Promise.resolve(currentAttempt);
    });
    vi.mocked(attemptsApi.submitAnswer).mockImplementation(
        (_attemptId, questionId, response: UserResponse) => {
            currentAttempt = {
                ...currentAttempt,
                questions: currentAttempt.questions.map((question) =>
                    question.id === questionId
                        ? { ...question, userResponse: response, answeredAt: timestamp }
                        : question,
                ),
            };
            return Promise.resolve(currentAttempt);
        },
    );
    vi.mocked(attemptsApi.completeAttempt).mockImplementation(() => {
        const answered = currentAttempt.questions.filter(
            (question) => question.userResponse !== null,
        ).length;
        currentAttempt = {
            ...currentAttempt,
            status: "completed",
            completedAt: timestamp,
            scoreSummary: { pointsAwarded: answered, pointsPossible: 3 },
            questions: currentAttempt.questions.map((question, index) => ({
                ...question,
                pointsAwarded: question.userResponse ? 1 : null,
                evaluationResult: question.userResponse
                    ? {
                          isCorrect: true,
                          pointsPossible: 1,
                          pointsAwarded: 1,
                          explanation: null,
                      }
                    : null,
                correctAnswer:
                    index === 0
                        ? { questionType: "exact_text", acceptedAnswers: ["Paris"] }
                        : index === 1
                          ? {
                                questionType: "multiple_choice_single",
                                options,
                                correctOptionId: "london",
                            }
                          : {
                                questionType: "multiple_choice_multi",
                                options: multiOptions,
                                correctOptionIds: ["red", "blue"],
                            },
                explanation: index === 0 ? "Paris is the capital of France." : null,
            })),
        };
        return Promise.resolve(currentAttempt);
    });
    vi.mocked(feedbackApi.createFeedback).mockImplementation((input) =>
        Promise.resolve({
            id: "923e4567-e89b-42d3-a456-426614174030",
            submittedBy: learnerId,
            questionId: input.questionId ?? null,
            quizId: input.quizId ?? null,
            quizAttemptQuestionId: input.quizAttemptQuestionId ?? null,
            category: input.category,
            comment: input.comment,
            status: "open",
            createdAt: timestamp,
            reviewedAt: null,
        } satisfies Feedback),
    );
});

it("starts, answers every format, completes, reviews, sends feedback, and opens history", async () => {
    const user = userEvent.setup();
    renderAt(`/quizzes/${quizId}`);
    await user.click(await screen.findByRole("button", { name: "Start new attempt" }));
    expect(await screen.findByRole("heading", { name: "World capitals" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Capital of France?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete quiz" })).toBeDisabled();

    await user.type(screen.getByRole("textbox", { name: "Your answer" }), "Paris");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(await screen.findByRole("heading", { name: "Capital of England?" })).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "London" }));
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(await screen.findByRole("heading", { name: "Primary colors?" })).toBeInTheDocument();
    await user.click(screen.getByRole("checkbox", { name: "Red" }));
    await user.click(screen.getByRole("checkbox", { name: "Blue" }));
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(vi.mocked(attemptsApi.submitAnswer).mock.calls.map((call) => call[2])).toEqual([
        { questionType: "exact_text", text: "Paris" },
        { questionType: "multiple_choice_single", optionId: "london" },
        { questionType: "multiple_choice_multi", optionIds: ["red", "blue"] },
    ]);
    expect(screen.getByRole("button", { name: "Complete quiz" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Complete quiz" }));

    const summary = await screen.findByRole("region", { name: "Result summary" });
    expect(within(summary).getByText("3 / 3 points")).toBeInTheDocument();
    expect(screen.getByText("Paris is the capital of France.")).toBeInTheDocument();
    const feedbackDetails = screen.getByText("Send feedback about question 1").closest("details");
    if (!feedbackDetails) throw new Error("Feedback form was not found");
    await user.click(screen.getByText("Send feedback about question 1"));
    await user.selectOptions(
        within(feedbackDetails).getByRole("combobox", { name: "Category" }),
        "typo",
    );
    await user.type(
        within(feedbackDetails).getByRole("textbox", { name: "Feedback" }),
        "Please check the wording.",
    );
    await user.click(within(feedbackDetails).getByRole("button", { name: "Send feedback" }));
    expect(vi.mocked(feedbackApi.createFeedback).mock.calls[0]?.[0]).toMatchObject({
        quizAttemptQuestionId: ids[0],
        category: "typo",
        comment: "Please check the wording.",
    });
    const quizFeedback = screen.getByText("Send feedback about this quiz").closest("details");
    if (!quizFeedback) throw new Error("Quiz feedback form was not found");
    await user.click(screen.getByText("Send feedback about this quiz"));
    await user.type(
        within(quizFeedback).getByRole("textbox", { name: "Feedback" }),
        "Great practice quiz.",
    );
    await user.click(within(quizFeedback).getByRole("button", { name: "Send feedback" }));
    expect(vi.mocked(feedbackApi.createFeedback).mock.calls[1]?.[0]).toMatchObject({
        quizId,
        comment: "Great practice quiz.",
    });
    await user.click(screen.getByRole("link", { name: "← Attempt history" }));
    expect(await screen.findByRole("heading", { name: "Attempt history" })).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "View results" }));
    expect(await screen.findByRole("region", { name: "Result summary" })).toBeInTheDocument();
});

it("loads the first unanswered question after a fresh visit to an attempt URL", async () => {
    started = true;
    currentAttempt = {
        ...currentAttempt,
        questions: currentAttempt.questions.map((question, index) =>
            index === 0
                ? {
                      ...question,
                      userResponse: { questionType: "exact_text", text: "Paris" },
                      answeredAt: timestamp,
                  }
                : question,
        ),
    };
    renderAt(`/attempts/${attemptId}`);
    expect(await screen.findByRole("heading", { name: "Capital of England?" })).toBeInTheDocument();
    expect(attemptsApi.getAttempt).toHaveBeenCalledWith(attemptId);
});

it("allows completion with an optional question unanswered", async () => {
    const user = userEvent.setup();
    started = true;
    currentAttempt = {
        ...currentAttempt,
        questions: currentAttempt.questions.map((question, index) =>
            index === 2 ? { ...question, required: false } : question,
        ),
    };
    renderAt(`/attempts/${attemptId}`);
    await user.type(await screen.findByRole("textbox", { name: "Your answer" }), "Paris");
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    await user.click(await screen.findByRole("radio", { name: "London" }));
    await user.click(screen.getByRole("button", { name: "Submit answer" }));
    expect(await screen.findByRole("heading", { name: "Primary colors?" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Complete quiz" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Complete quiz" }));
    expect(await screen.findByText("2 / 3 points")).toBeInTheDocument();
    expect(screen.getByText("No answer submitted")).toBeInTheDocument();
});

it("hides correct answers and explanations when the saved setting disables review answers", async () => {
    started = true;
    const responses: UserResponse[] = [
        { questionType: "exact_text", text: "Paris" },
        { questionType: "multiple_choice_single", optionId: "london" },
        { questionType: "multiple_choice_multi", optionIds: ["red", "blue"] },
    ];
    currentAttempt = {
        ...currentAttempt,
        questions: currentAttempt.questions.map((question, index) => ({
            ...question,
            userResponse: responses[index]!,
            answeredAt: timestamp,
        })),
    };
    const completed = await attemptsApi.completeAttempt(attemptId);
    currentAttempt = {
        ...completed,
        settings: { ...completed.settings, showAnswersAfterCompletion: false },
    };
    renderAt(`/attempts/${attemptId}`);
    expect(
        await screen.findByText("Correct answers are hidden for this quiz."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Correct answer:/)).not.toBeInTheDocument();
    expect(screen.queryByText("Paris is the capital of France.")).not.toBeInTheDocument();
    expect(screen.getByText("3 / 3 points")).toBeInTheDocument();
});
