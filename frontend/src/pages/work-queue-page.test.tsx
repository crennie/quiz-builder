import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import type { WorkItem } from "@quiz-builder/contracts";
import type { Session } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as workflow from "../api/content-workflow";
import { router } from "../app/router";
import { createQueryClient } from "../app/query-client";
import { AuthContext } from "../auth/auth-state";

vi.mock("../api/content-workflow", () => ({
    listWorkItems: vi.fn(),
    claimWorkItem: vi.fn(),
    decideWorkItem: vi.fn(),
    failWorkItem: vi.fn(),
    cancelWorkItem: vi.fn(),
    handOffFailedAgentItem: vi.fn(),
    submitQuestionReview: vi.fn(),
    requestAgentQuestion: vi.fn(),
}));

const owner = "123e4567-e89b-42d3-a456-426614174030";
const questionId = "223e4567-e89b-42d3-a456-426614174030";
const versionId = "323e4567-e89b-42d3-a456-426614174030";
const itemId = "423e4567-e89b-42d3-a456-426614174030";
const token = "523e4567-e89b-42d3-a456-426614174030";
const pending: WorkItem = {
    id: itemId,
    queueName: "question-review",
    itemType: "REVIEW_QUESTION",
    questionId,
    questionVersionId: versionId,
    versionNumber: 1,
    prompt: "Capital of France?",
    input: { schemaVersion: 1, type: "REVIEW_QUESTION", versionId },
    status: "pending",
    attempts: 0,
    claimGeneration: 0,
    claimToken: null,
    assignedAgentActorId: null,
    leaseUntil: null,
    createdAt: "2026-09-30T00:00:00.000Z",
};

it("claims human review and records a content decision from the queue", async () => {
    const user = userEvent.setup();
    let items = [pending];
    const claimed: WorkItem = {
        ...pending,
        status: "claimed",
        attempts: 1,
        claimGeneration: 1,
        claimToken: token,
        leaseUntil: "2099-01-01T00:00:00.000Z",
    };
    vi.mocked(workflow.listWorkItems).mockImplementation(() => Promise.resolve({ items }));
    vi.mocked(workflow.claimWorkItem).mockImplementation(() => {
        items = [claimed];
        return Promise.resolve(claimed);
    });
    vi.mocked(workflow.decideWorkItem).mockImplementation(() => {
        const completed: WorkItem = { ...claimed, status: "completed" };
        items = [completed];
        return Promise.resolve(completed);
    });
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const testRouter = createRouter({
        routeTree: router.routeTree,
        history: createMemoryHistory({ initialEntries: ["/work-items"] }),
    });
    render(
        <QueryClientProvider client={createQueryClient()}>
            <AuthContext.Provider
                value={{
                    session: { user: { id: owner } } as Session,
                    loading: false,
                    configured: true,
                }}
            >
                <RouterProvider router={testRouter} />
            </AuthContext.Provider>
        </QueryClientProvider>,
    );
    await user.click(await screen.findByRole("button", { name: "Claim item" }));
    await user.click(await screen.findByRole("button", { name: "Approve content" }));
    await waitFor(() =>
        expect(workflow.decideWorkItem).toHaveBeenCalledWith(itemId, token, "approved", ""),
    );
    expect(await screen.findByText(/question-review · completed/)).toBeInTheDocument();
});

it("queues a sponsored agent question from the creation page", async () => {
    const user = userEvent.setup();
    vi.mocked(workflow.requestAgentQuestion).mockResolvedValue(pending);
    vi.mocked(workflow.listWorkItems).mockResolvedValue({ items: [pending] });
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const testRouter = createRouter({
        routeTree: router.routeTree,
        history: createMemoryHistory({ initialEntries: ["/questions/agent"] }),
    });
    render(
        <QueryClientProvider client={createQueryClient()}>
            <AuthContext.Provider
                value={{
                    session: { user: { id: owner } } as Session,
                    loading: false,
                    configured: true,
                }}
            >
                <RouterProvider router={testRouter} />
            </AuthContext.Provider>
        </QueryClientProvider>,
    );
    await user.type(
        await screen.findByRole("textbox", { name: "Question brief" }),
        "Create a question about planets",
    );
    await user.click(screen.getByRole("button", { name: "Queue generation" }));
    await waitFor(() =>
        expect(workflow.requestAgentQuestion).toHaveBeenCalledWith(
            "Create a question about planets",
            expect.any(String),
        ),
    );
    expect(await screen.findByRole("heading", { name: "Work queue" })).toBeInTheDocument();
});

it("offers human handoff for a failed agent review", async () => {
    const user = userEvent.setup();
    const failed: WorkItem = {
        ...pending,
        status: "failed",
        attempts: 3,
        assignedAgentActorId: "00000000-0000-4000-8000-00000000a002",
    };
    vi.mocked(workflow.listWorkItems).mockResolvedValue({ items: [failed] });
    vi.mocked(workflow.handOffFailedAgentItem).mockResolvedValue({
        ...failed,
        status: "pending",
        attempts: 0,
        assignedAgentActorId: null,
    });
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const testRouter = createRouter({
        routeTree: router.routeTree,
        history: createMemoryHistory({ initialEntries: ["/work-items"] }),
    });
    render(
        <QueryClientProvider client={createQueryClient()}>
            <AuthContext.Provider
                value={{
                    session: { user: { id: owner } } as Session,
                    loading: false,
                    configured: true,
                }}
            >
                <RouterProvider router={testRouter} />
            </AuthContext.Provider>
        </QueryClientProvider>,
    );
    await user.click(await screen.findByRole("button", { name: "Hand off to human" }));
    expect(workflow.handOffFailedAgentItem).toHaveBeenCalledWith(itemId);
});
