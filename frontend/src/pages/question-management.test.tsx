import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import type { Session } from "@supabase/supabase-js";
import { render, screen } from "@testing-library/react";
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
