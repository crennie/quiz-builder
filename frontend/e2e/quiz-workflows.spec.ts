import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

async function signUp(page: Page) {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "New here? Create an account" }).click();
    await page.getByLabel("Email").fill(`phase10-${randomUUID()}@example.test`);
    await page.getByLabel("Password").fill("LocalTestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "My questions" })).toBeVisible();
}

async function createQuestion(page: Page, prompt: string, answer: string) {
    await page.goto("/questions/new");
    await page.getByLabel("Question prompt").fill(prompt);
    await page.getByLabel("One answer per line").fill(answer);
    await page.getByRole("button", { name: "Create question" }).click();
    await expect(page).toHaveURL(/\/questions\/[0-9a-f-]{36}$/);
    return page.url();
}

async function createQuiz(page: Page, title: string, prompt: string) {
    await page.goto("/quizzes/new");
    await page.getByLabel("Quiz title").fill(title);
    await page.getByRole("button", { name: "Add question" }).click();
    await page.getByRole("button", { name: prompt, exact: true }).click();
    await page.getByRole("button", { name: "Create quiz" }).click();
    await expect(page).toHaveURL(/\/quizzes\/[0-9a-f-]{36}$/);
    return page.url();
}

async function completeQuiz(page: Page, answer: string) {
    await page.getByRole("button", { name: "Start new attempt" }).click();
    await expect(page).toHaveURL(/\/attempts\/[^/]+$/);
    await page.getByLabel("Your answer").fill(answer);
    await page.getByRole("button", { name: "Submit answer" }).click();
    await expect(page.getByText(`Your saved answer: ${answer}`)).toBeVisible();
    await page.getByRole("button", { name: "Complete quiz" }).click();
    await expect(page.getByRole("heading", { name: "Result" })).toBeVisible();
    return page.url();
}

test("creates a private quiz, then completes and reviews an attempt", async ({ page }) => {
    await signUp(page);
    const prompt = `Capital of France ${randomUUID()}?`;
    await createQuestion(page, prompt, "Paris");
    await createQuiz(page, "Geography practice", prompt);
    await completeQuiz(page, "Paris");
    await expect(page.getByLabel("Result summary")).toContainText("1 / 1 points");
    await expect(page.getByLabel("Question review")).toContainText(prompt);
    await expect(page.getByLabel("Question review")).toContainText("Correct answer: Paris");
    await page.getByRole("link", { name: "Attempt history", exact: true }).click();
    await expect(page.getByRole("link", { name: "View results" })).toBeVisible();
});

test("locks used content and preserves an old attempt after independent replacements", async ({
    page,
}) => {
    await signUp(page);
    const original = `Capital of France ${randomUUID()}?`;
    const replacement = `Capital of the UK ${randomUUID()}?`;
    const questionUrl = await createQuestion(page, original, "Paris");
    const quizUrl = await createQuiz(page, "Original geography", original);
    const oldAttempt = await completeQuiz(page, "Paris");
    await page.goto(questionUrl);
    await expect(page.getByText(/permanently locked/)).toBeVisible();
    await expect(page.getByLabel("Question prompt")).toHaveCount(0);
    await page.goto(quizUrl);
    await expect(
        page.getByText(/After an attempt, changes require a new quiz record/),
    ).toBeVisible();
    await expect(page.getByLabel("Quiz title")).toHaveCount(0);
    await createQuestion(page, replacement, "London");
    await createQuiz(page, "Replacement geography", replacement);
    await completeQuiz(page, "London");
    await page.goto(oldAttempt);
    await expect(page.getByLabel("Question review")).toContainText(original);
    await expect(page.getByLabel("Question review")).not.toContainText(replacement);
    await expect(page.getByLabel("Result summary")).toContainText("1 / 1 points");
});
