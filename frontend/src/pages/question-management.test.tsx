import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import * as questionsApi from "../api/questions";
import { router } from "../app/router";
import { createQueryClient } from "../app/query-client";
import { AuthContext } from "../auth/auth-state";

vi.mock("../api/questions", () => ({
    listQuestions: vi.fn(),
    getQuestion: vi.fn(),
    getQuestionVersions: vi.fn(),
    createQuestion: vi.fn(),
    createQuestionVersion: vi.fn(),
    updateQuestionMetadata: vi.fn(),
    listTags: vi.fn(),
    createTag: vi.fn(),
    assignQuestionTag: vi.fn(),
    removeQuestionTag: vi.fn(),
}));

const ownerId = "123e4567-e89b-42d3-a456-426614174030";
const questionId = "223e4567-e89b-42d3-a456-426614174030";
const versionId = "323e4567-e89b-42d3-a456-426614174030";
const tagId = "423e4567-e89b-42d3-a456-426614174030";
const timestamp = "2026-09-28T00:00:00.000Z";
const tag = { id: tagId, name: "Geography", slug: "geography", createdAt: timestamp };
const detail = {
    id: questionId,
    createdBy: ownerId,
    visibility: "private" as const,
    status: "draft" as const,
    createdAt: timestamp,
    updatedAt: timestamp,
    tags: [],
    isOwner: true,
    currentVersion: {
        id: versionId,
        versionNumber: 1,
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
    vi.mocked(questionsApi.listQuestions).mockResolvedValue({ items: [detail], nextOffset: null });
    vi.mocked(questionsApi.getQuestion).mockResolvedValue(detail);
    vi.mocked(questionsApi.getQuestionVersions).mockResolvedValue({
        versions: [detail.currentVersion],
    });
    vi.mocked(questionsApi.listTags).mockResolvedValue([tag]);
});

it("lists, filters, and creates question-bank tags", async () => {
    const user = userEvent.setup();
    vi.mocked(questionsApi.createTag).mockResolvedValue(tag);
    renderAt("/questions");
    expect(await screen.findByRole("link", { name: "Capital of France?" })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Tag" }), "geography");
    expect(questionsApi.listQuestions).toHaveBeenCalledWith({ tag: "geography", offset: 0 });
    await user.type(screen.getByRole("textbox", { name: "New tag" }), "Geography");
    await user.click(screen.getByRole("button", { name: "Add tag" }));
    expect(vi.mocked(questionsApi.createTag).mock.calls[0]?.[0]).toBe("Geography");
});

it("creates a question from the shared editor", async () => {
    const user = userEvent.setup();
    vi.mocked(questionsApi.createQuestion).mockResolvedValue(detail);
    renderAt("/questions/new");
    await user.type(
        await screen.findByRole("textbox", { name: "Question prompt" }),
        "Capital of France?",
    );
    await user.type(screen.getByRole("textbox", { name: "One answer per line" }), "Paris");
    await user.click(screen.getByRole("button", { name: "Create question" }));
    expect(vi.mocked(questionsApi.createQuestion).mock.calls[0]?.[0]).toMatchObject({
        visibility: "private",
        status: "draft",
        content: { prompt: "Capital of France?", questionType: "exact_text" },
    });
    expect(await screen.findByRole("heading", { name: "Capital of France?" })).toBeInTheDocument();
});

it("saves a new version and manages metadata and tags", async () => {
    const user = userEvent.setup();
    vi.mocked(questionsApi.createQuestionVersion).mockResolvedValue(detail);
    vi.mocked(questionsApi.updateQuestionMetadata).mockResolvedValue(detail);
    vi.mocked(questionsApi.assignQuestionTag).mockResolvedValue(detail);
    renderAt(`/questions/${questionId}`);
    expect(await screen.findByRole("heading", { name: "Capital of France?" })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Visibility" }), "public");
    expect(questionsApi.updateQuestionMetadata).toHaveBeenCalledWith(questionId, {
        visibility: "public",
    });
    await user.selectOptions(screen.getByRole("combobox", { name: "Tag to add" }), tagId);
    await user.click(screen.getByRole("button", { name: "Add tag" }));
    expect(questionsApi.assignQuestionTag).toHaveBeenCalledWith(questionId, tagId);
    await user.clear(screen.getByRole("textbox", { name: "Question prompt" }));
    await user.type(
        screen.getByRole("textbox", { name: "Question prompt" }),
        "Capital city of France?",
    );
    await user.click(screen.getByRole("button", { name: "Save new version" }));
    expect(questionsApi.createQuestionVersion).toHaveBeenCalledWith(
        questionId,
        expect.objectContaining({ prompt: "Capital city of France?" }),
    );
});

it("filters the loaded question page and moves through API pages", async () => {
    const user = userEvent.setup();
    vi.mocked(questionsApi.listQuestions).mockImplementation(({ offset }) =>
        Promise.resolve({
            items: [
                offset === 0
                    ? detail
                    : {
                          ...detail,
                          id: "523e4567-e89b-42d3-a456-426614174030",
                          visibility: "public",
                          status: "published",
                          currentVersion: { ...detail.currentVersion, prompt: "Capital of Spain?" },
                      },
            ],
            nextOffset: offset === 0 ? 50 : null,
        }),
    );
    renderAt("/questions");
    expect(await screen.findByRole("link", { name: "Capital of France?" })).toBeInTheDocument();
    await user.type(screen.getByRole("searchbox", { name: "Search prompts" }), "Spain");
    expect(screen.getByText("No questions match these filters.")).toBeInTheDocument();
    await user.clear(screen.getByRole("searchbox", { name: "Search prompts" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Visibility" }), "public");
    expect(screen.getByText("No questions match these filters.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("link", { name: "Capital of Spain?" })).toBeInTheDocument();
    expect(questionsApi.listQuestions).toHaveBeenCalledWith({ offset: 50 });
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "draft");
    expect(screen.getByText("No questions match these filters.")).toBeInTheDocument();
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "published");
    await user.type(screen.getByRole("searchbox", { name: "Search prompts" }), "Spain");
    expect(screen.getByRole("link", { name: "Capital of Spain?" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Previous" }));
    expect(questionsApi.listQuestions).toHaveBeenCalledWith({ offset: 0 });
});

it("shows a loading state while the question bank is pending", async () => {
    vi.mocked(questionsApi.listQuestions).mockReturnValue(new Promise(() => {}));
    renderAt("/questions");
    expect(await screen.findByText("Loading questions…")).toBeInTheDocument();
});

it("shows a question loading error and retries", async () => {
    const user = userEvent.setup();
    vi.mocked(questionsApi.listQuestions)
        .mockRejectedValueOnce(new Error("Bank unavailable"))
        .mockRejectedValueOnce(new Error("Bank unavailable"))
        .mockResolvedValue({ items: [detail], nextOffset: null });
    renderAt("/questions");
    expect(await screen.findByRole("alert", {}, { timeout: 3000 })).toHaveTextContent(
        "Could not load questions. Bank unavailable",
    );
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("link", { name: "Capital of France?" })).toBeInTheDocument();
});

it("creates a published unlisted question and handles owner lifecycle and tag removal", async () => {
    const user = userEvent.setup();
    vi.mocked(questionsApi.createQuestion).mockResolvedValue(detail);
    vi.mocked(questionsApi.updateQuestionMetadata).mockResolvedValue(detail);
    vi.mocked(questionsApi.removeQuestionTag).mockResolvedValue(undefined);
    vi.mocked(questionsApi.getQuestion).mockResolvedValue({
        ...detail,
        tags: [tag],
    });
    renderAt("/questions/new");
    await user.type(await screen.findByRole("textbox", { name: "Question prompt" }), "A prompt");
    await user.type(screen.getByRole("textbox", { name: "One answer per line" }), "Answer");
    await user.selectOptions(screen.getByRole("combobox", { name: "Visibility" }), "unlisted");
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "published");
    await user.click(screen.getByRole("button", { name: "Create question" }));
    expect(vi.mocked(questionsApi.createQuestion).mock.calls[0]?.[0]).toMatchObject({
        visibility: "unlisted",
        status: "published",
    });
    expect(await screen.findByRole("heading", { name: "Version history" })).toBeInTheDocument();
    expect(await screen.findByText("Version 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Geography tag" }));
    expect(questionsApi.removeQuestionTag).toHaveBeenCalledWith(questionId, tagId);
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "archived");
    await waitFor(() =>
        expect(questionsApi.updateQuestionMetadata).toHaveBeenCalledWith(questionId, {
            status: "archived",
        }),
    );
});
