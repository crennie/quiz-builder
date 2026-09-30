import { getAttempt } from "./attempts";
import { authenticatedRequest } from "./client";
import { createFeedback } from "./feedback";
import { getQuestion } from "./questions";
import { getQuiz, listQuizzes } from "./quizzes";

vi.mock("./client", () => ({ authenticatedRequest: vi.fn() }));

it("rejects malformed question, quiz, attempt, and feedback API responses", async () => {
    vi.mocked(authenticatedRequest).mockResolvedValue({ unexpected: true });
    const id = "123e4567-e89b-42d3-a456-426614174030";
    const requests = [
        getQuestion(id),
        getQuiz(id),
        getAttempt(id),
        createFeedback({ quizId: id, category: "other", comment: "A comment" }),
    ];
    await Promise.all(
        requests.map((result) => expect(result).rejects.toMatchObject({ name: "ZodError" })),
    );
    expect(authenticatedRequest).toHaveBeenCalledTimes(4);
});

it("sends the owner scope and page offset to the quiz API", async () => {
    vi.mocked(authenticatedRequest).mockResolvedValueOnce({ items: [], nextOffset: null });
    await listQuizzes({ scope: "mine", offset: 50 });
    expect(authenticatedRequest).toHaveBeenCalledWith("/v1/quizzes?limit=50&offset=50&scope=mine");
});
