import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createMemoryHistory, createRouter } from "@tanstack/react-router";
import { questionBatchArtifactSchema, type QuestionBatch } from "@quiz-builder/contracts";
import type { Session } from "@supabase/supabase-js";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as workflow from "../api/content-workflow";
import { router } from "../app/router";
import { createQueryClient } from "../app/query-client";
import { AuthContext } from "../auth/auth-state";

vi.mock("../api/content-workflow", () => ({
    getQuestionBatch: vi.fn(),
    ingestQuestionBatch: vi.fn(),
    listQuestionBatches: vi.fn(),
    materializeQuestionBatch: vi.fn(),
    submitQuestionReview: vi.fn(),
    listWorkItems: vi.fn(),
    requestAgentQuestion: vi.fn(),
}));

const owner = "00000000-0000-4000-8000-000000000821";
const questionId = "00000000-0000-4000-8000-000000000822";
const versionId = "00000000-0000-4000-8000-000000000823";
const artifact = questionBatchArtifactSchema.parse({
    schemaVersion: 1,
    batchKey: "00000000-0000-4000-8000-000000000824",
    topic: "REST endpoints",
    source: { kind: "external_agent", label: "Offline agent" },
    tags: ["Backend"],
    questions: [
        {
            key: "rest-01",
            content: {
                prompt: "Which method retrieves a resource?",
                questionType: "exact_text",
                answerConfig: { questionType: "exact_text", acceptedAnswers: ["GET"] },
                gradingConfig: {
                    questionType: "exact_text",
                    caseSensitive: false,
                    trimWhitespace: true,
                },
                explanation: "GET retrieves a resource representation.",
            },
        },
    ],
});
const retained: QuestionBatch = {
    id: "00000000-0000-4000-8000-000000000825",
    artifact,
    artifactSha256: "a".repeat(64),
    createdAt: "2026-10-01T00:00:00.000Z",
    items: [],
};
const materialized: QuestionBatch = {
    ...retained,
    items: [{ key: "rest-01", questionId, versionId, currentVersionId: versionId }],
};

it("uploads a batch artifact, materializes drafts, then explicitly submits one for review", async () => {
    const user = userEvent.setup();
    let current = retained;
    vi.mocked(workflow.listQuestionBatches).mockImplementation(() =>
        Promise.resolve({
            batches:
                current === retained
                    ? []
                    : [
                          {
                              id: retained.id,
                              topic: artifact.topic,
                              artifactSha256: retained.artifactSha256,
                              createdAt: retained.createdAt,
                              questionCount: 1,
                              materializedCount: current.items.length,
                          },
                      ],
        }),
    );
    vi.mocked(workflow.ingestQuestionBatch).mockResolvedValue(retained);
    vi.mocked(workflow.getQuestionBatch).mockImplementation(() => Promise.resolve(current));
    vi.mocked(workflow.materializeQuestionBatch).mockImplementation(() => {
        current = materialized;
        return Promise.resolve(materialized);
    });
    vi.mocked(workflow.submitQuestionReview).mockResolvedValue({
        id: "00000000-0000-4000-8000-000000000826",
        queueName: "question-review",
        itemType: "REVIEW_QUESTION",
        questionId,
        questionVersionId: versionId,
        versionNumber: 1,
        prompt: artifact.questions[0]!.content.prompt,
        input: { schemaVersion: 1, type: "REVIEW_QUESTION", versionId },
        status: "pending",
        attempts: 0,
        claimGeneration: 0,
        claimToken: null,
        assignedAgentActorId: null,
        leaseUntil: null,
        createdAt: retained.createdAt,
    });
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const testRouter = createRouter({
        routeTree: router.routeTree,
        history: createMemoryHistory({ initialEntries: ["/questions/batches"] }),
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
    const file = new File([JSON.stringify(artifact)], "rest-batch.json", {
        type: "application/json",
    });
    Object.defineProperty(file, "text", { value: () => Promise.resolve(JSON.stringify(artifact)) });
    await user.upload(await screen.findByLabelText("Question batch JSON"), file);
    await user.click(await screen.findByRole("button", { name: "Retain batch artifact" }));
    await waitFor(() =>
        expect(workflow.ingestQuestionBatch).toHaveBeenCalledWith(artifact, expect.anything()),
    );
    await user.click(await screen.findByRole("button", { name: "Create private drafts" }));
    await waitFor(() =>
        expect(workflow.materializeQuestionBatch).toHaveBeenCalledWith(
            retained.id,
            expect.anything(),
        ),
    );
    await user.click(await screen.findByRole("button", { name: "Submit for review" }));
    await waitFor(() =>
        expect(workflow.submitQuestionReview).toHaveBeenCalledWith(questionId, versionId),
    );
});
