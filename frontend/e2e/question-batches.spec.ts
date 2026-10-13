import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

test("imports private questions ready for immediate quiz use", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "New here? Create an account" }).click();
    await page.getByLabel("Email").fill(`batch-${randomUUID()}@example.test`);
    await page.getByLabel("Password").fill("LocalTestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "My questions" })).toBeVisible();

    const key = randomUUID();
    const firstPrompt = `Which HTTP method retrieves a resource ${key}?`;
    const secondPrompt = `Which HTTP status reports creation ${key}?`;
    const exactText = (prompt: string, answer: string) => ({
        prompt,
        questionType: "exact_text",
        answerConfig: { questionType: "exact_text", acceptedAnswers: [answer] },
        gradingConfig: {
            questionType: "exact_text",
            caseSensitive: false,
            trimWhitespace: true,
        },
        explanation: null,
    });
    const artifact = {
        schemaVersion: 1,
        batchKey: key,
        topic: `REST endpoints ${key}`,
        source: { kind: "external_agent", label: "Offline author" },
        tags: ["Technical", "Backend"],
        questions: [
            { key: "rest-01", content: exactText(firstPrompt, "GET") },
            { key: "rest-02", content: exactText(secondPrompt, "201") },
        ],
    };

    await page.goto("/questions/batches");
    await page.getByLabel("Question batch JSON").setInputFiles({
        name: "rest-batch.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(artifact)),
    });
    await expect(page.getByText(firstPrompt)).toBeVisible();
    await expect(page.getByText(secondPrompt)).toBeVisible();
    await page.getByRole("button", { name: "Retain batch artifact" }).click();
    await expect(page.getByRole("button", { name: "Create private questions" })).toBeVisible();
    await expect(page.getByRole("link", { name: /rest-01/ })).toHaveCount(0);

    await page.reload();
    await page.getByRole("button", { name: new RegExp(`REST endpoints ${key}`) }).click();
    await page.getByRole("button", { name: "Create private questions" }).click();
    await expect(page.getByRole("link", { name: `rest-01: ${firstPrompt}` })).toBeVisible();
    await expect(page.getByRole("link", { name: `rest-02: ${secondPrompt}` })).toBeVisible();

    await page.getByRole("link", { name: `rest-01: ${firstPrompt}` }).click();
    await expect(page.getByLabel("Question prompt")).toBeVisible();
    await page.goto("/questions/mine");
    await expect(page.getByRole("link", { name: firstPrompt })).toBeVisible();
    await expect(page.getByRole("link", { name: secondPrompt })).toBeVisible();
    await page.goto("/quizzes/new");
    await page.getByLabel("Quiz title").fill("Imported practice");
    await page.getByRole("button", { name: "Add question" }).click();
    await page.getByRole("button", { name: firstPrompt, exact: true }).click();
    await page.getByRole("button", { name: "Create quiz" }).click();
    await expect(page.getByRole("button", { name: "Start new attempt" })).toBeVisible();
});
