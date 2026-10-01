import { randomUUID } from "node:crypto";

import { expect, test } from "@playwright/test";

test("imports a batch and publishes one reviewed question into the bank", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("button", { name: "New here? Create an account" }).click();
    await page.getByLabel("Email").fill(`batch-${randomUUID()}@example.test`);
    await page.getByLabel("Password").fill("LocalTestPassword123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByRole("heading", { name: "Your questions" })).toBeVisible();

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
    await expect(page.getByRole("button", { name: "Create private drafts" })).toBeVisible();
    await expect(page.getByRole("link", { name: /rest-01/ })).toHaveCount(0);

    await page.reload();
    await page.getByRole("button", { name: new RegExp(`REST endpoints ${key}`) }).click();
    await page.getByRole("button", { name: "Create private drafts" }).click();
    await expect(page.getByRole("link", { name: `rest-01: ${firstPrompt}` })).toBeVisible();
    await expect(page.getByRole("link", { name: `rest-02: ${secondPrompt}` })).toBeVisible();

    await page.getByRole("link", { name: `rest-01: ${firstPrompt}` }).click();
    await expect(page.getByRole("button", { name: "Publish current version" })).toHaveCount(0);
    await page.goto("/questions/batches");
    await page.getByRole("button", { name: new RegExp(`REST endpoints ${key}`) }).click();
    await page.getByRole("button", { name: "Submit for review" }).first().click();
    await expect(page.getByRole("status")).toContainText("Review item queued");
    await page.goto("/work-items");
    await expect(page.getByText(firstPrompt)).toBeVisible();
    await expect(page.getByRole("button", { name: "Claim item" })).toBeVisible();

    await page.goto("/questions");
    await expect(page.getByRole("link", { name: firstPrompt })).toHaveCount(0);
    await page.goto("/work-items");
    await page.getByRole("button", { name: "Claim item" }).click();
    await page.getByRole("button", { name: "Approve content" }).click();
    await expect(page.getByRole("button", { name: "Claim item" })).toBeVisible();

    await page.goto("/questions");
    await expect(page.getByRole("link", { name: firstPrompt })).toHaveCount(0);
    await page.goto("/work-items");
    await page.getByRole("button", { name: "Claim item" }).click();
    await page.getByRole("button", { name: "Approve and publish" }).click();

    await page.goto("/questions");
    await expect(page.getByRole("link", { name: firstPrompt })).toBeVisible();
    await expect(page.getByRole("link", { name: secondPrompt })).toHaveCount(0);
});
