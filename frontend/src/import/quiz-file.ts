import { questionBatchArtifactSchema, type QuestionBatchArtifact } from "@quiz-builder/contracts";

export type QuizImport = { artifact: QuestionBatchArtifact; description: string | null };

function object(value: unknown): Record<string, unknown> {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        throw new Error("Expected a JSON object.");
    return value as Record<string, unknown>;
}

export function parseQuizFile(value: unknown): QuizImport {
    const document = object(value);
    if ("schemaVersion" in document) {
        return { artifact: questionBatchArtifactSchema.parse(document), description: null };
    }
    if (typeof document.title !== "string" || !Array.isArray(document.questions))
        throw new Error(
            "Include a title and a questions array. Download the example for the expected format.",
        );
    if (document.description !== undefined && typeof document.description !== "string")
        throw new Error("Description must be text.");
    const artifact = questionBatchArtifactSchema.parse({
        schemaVersion: 1,
        batchKey: crypto.randomUUID(),
        topic: document.title.trim(),
        source: { kind: "human", label: "Quiz file upload" },
        tags: [],
        questions: document.questions.map((value: unknown, index: number) => {
            const question = object(value);
            if (typeof question.answer !== "string" || !question.answer.trim())
                throw new Error(`Question ${index + 1} needs a nonempty text answer.`);
            return {
                key: `question-${index + 1}`,
                content: {
                    prompt: question.prompt,
                    questionType: "exact_text",
                    answerConfig: {
                        questionType: "exact_text",
                        acceptedAnswers: [question.answer.trim()],
                    },
                    gradingConfig: {
                        questionType: "exact_text",
                        caseSensitive: false,
                        trimWhitespace: true,
                    },
                    explanation: question.explanation ?? null,
                },
            };
        }),
    });
    return { artifact, description: document.description?.trim() || null };
}
