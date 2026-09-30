import { randomUUID } from "node:crypto";

import { expect, test, type Page } from "@playwright/test";

async function signUp(page: Page) {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "New here? Create an account" }).click();
    await page.getByLabel("Email").fill(`phase10-${randomUUID()}@example.test`);
    await page.getByLabel("Password").fill("LocalTestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Your questions" })).toBeVisible();
}

async function createQuestion(page: Page, prompt: string, answer: string) {
    await page.goto("/questions/new");
    await page.getByLabel("Question prompt").fill(prompt);
    await page.getByLabel("One answer per line").fill(answer);
    await page.getByRole("button", { name: "Create question" }).click();
    await expect(page).toHaveURL(/\/questions\/mine\/[0-9a-f-]{36}$/);
    await page.getByRole("button", { name: "Publish current version" }).click();
    await expect(page.getByText("published", { exact: false }).first()).toBeVisible();
    return page.url();
}

async function createQuiz(page: Page, title: string, prompt: string) {
    await page.goto("/quizzes/new");
    await page.getByLabel("Quiz title").fill(title);
    await page.getByRole("button", { name: "Add question" }).click();
    await page.getByRole("button", { name: prompt, exact: true }).click();
    await page.getByRole("button", { name: `Select version 1: ${prompt}` }).click();
    await page.getByRole("button", { name: "Create quiz" }).click();
    await expect(page).toHaveURL(/\/quizzes\/[0-9a-f-]{36}$/);
    await page.getByLabel("Status", { exact: true }).selectOption("published");
    await expect(page.getByLabel("Status", { exact: true })).toHaveValue("published");
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

test("creates and publishes a quiz, then completes and reviews an attempt", async ({ page }) => {
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

test("keeps an old attempt on version 1 after an explicit quiz question update", async ({
    page,
}) => {
    await signUp(page);
    const originalPrompt = `Capital of France ${randomUUID()}?`;
    const revisedPrompt = `Capital of the UK ${randomUUID()}?`;
    const questionUrl = await createQuestion(page, originalPrompt, "Paris");
    const quizUrl = await createQuiz(page, "Versioned geography", originalPrompt);
    const oldAttemptUrl = await completeQuiz(page, "Paris");

    await page.goto(questionUrl);
    await page.getByLabel("Question prompt").fill(revisedPrompt);
    await page.getByLabel("One answer per line").fill("London");
    await page.getByRole("button", { name: "Save new version" }).click();
    await expect(page.getByText("Version 2", { exact: false }).first()).toBeVisible();
    await page.getByRole("button", { name: "Publish current version" }).click();

    await page.goto(quizUrl);
    await expect(page.getByText(originalPrompt, { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Change question or version" }).click();
    await page.getByRole("button", { name: revisedPrompt, exact: true }).click();
    await page.getByRole("button", { name: `Select version 2: ${revisedPrompt}` }).click();
    await page.getByRole("button", { name: "Save quiz", exact: true }).click();
    await expect(page.getByText("Quiz · Version 2")).toBeVisible();

    await page.goto(oldAttemptUrl);
    await expect(page.getByLabel("Question review")).toContainText(originalPrompt);
    await expect(page.getByLabel("Question review")).not.toContainText(revisedPrompt);
    await expect(page.getByLabel("Result summary")).toContainText("1 / 1 points");

    await page.goto(quizUrl);
    await page.getByRole("button", { name: "Start new attempt" }).click();
    await expect(page.getByRole("heading", { name: revisedPrompt })).toBeVisible();
});
