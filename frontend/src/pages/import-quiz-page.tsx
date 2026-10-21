import { useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";

import { ingestQuestionBatch, materializeQuestionBatch } from "../api/question-batches";
import { createQuiz } from "../api/quizzes";
import { parseQuizFile, type QuizImport } from "../import/quiz-file";

export function ImportQuizPage() {
    const navigate = useNavigate();
    const client = useQueryClient();
    const [preview, setPreview] = useState<QuizImport | null>(null);
    const [busy, setBusy] = useState(false);
    const [reading, setReading] = useState(false);
    const [error, setError] = useState("");
    const [status, setStatus] = useState("");
    const batchId = useRef<string | null>(null);
    const quizId = useRef<string | null>(null);
    const readVersion = useRef(0);

    async function readFile(file: File | undefined) {
        const version = ++readVersion.current;
        setPreview(null);
        batchId.current = null;
        quizId.current = null;
        setError("");
        setStatus("");
        if (!file) return;
        setReading(true);
        try {
            if (file.size > 256 * 1024)
                throw new Error("Choose a JSON file no larger than 256 KiB.");
            const value: unknown = JSON.parse(await file.text());
            const parsed = parseQuizFile(value);
            if (new TextEncoder().encode(JSON.stringify(parsed.artifact)).length > 256 * 1024)
                throw new Error(
                    "The expanded quiz exceeds the import size limit. Use shorter questions or split the file.",
                );
            if (version === readVersion.current) setPreview(parsed);
        } catch (error) {
            if (version === readVersion.current)
                setError(error instanceof Error ? error.message : "Could not read quiz file.");
        } finally {
            if (version === readVersion.current) setReading(false);
        }
    }

    async function importQuiz() {
        if (!preview || busy) return;
        setBusy(true);
        setError("");
        try {
            if (!quizId.current) {
                setStatus("Importing questions…");
                batchId.current ??= (await ingestQuestionBatch(preview.artifact)).id;
                const batch = await materializeQuestionBatch(batchId.current);
                const questions = preview.artifact.questions.map((question) => {
                    const item = batch.items.find((item) => item.key === question.key);
                    if (!item)
                        throw new Error(
                            "An imported question is missing. Please retry the import.",
                        );
                    return {
                        questionId: item.questionId,
                        points: 1,
                        required: true,
                        timeLimitSeconds: null,
                    };
                });
                setStatus("Creating quiz…");
                const quiz = await createQuiz({
                    content: {
                        title: preview.artifact.topic,
                        description: preview.description,
                        settings: { shuffleQuestions: false, showAnswersAfterCompletion: true },
                        questions,
                    },
                });
                quizId.current = quiz.id;
            }
            await Promise.all([
                client.invalidateQueries({ queryKey: ["quizzes"] }),
                client.invalidateQueries({ queryKey: ["questions"] }),
                client.invalidateQueries({ queryKey: ["question"] }),
                client.invalidateQueries({ queryKey: ["question-batches"] }),
                client.invalidateQueries({ queryKey: ["tags"] }),
            ]);
            await navigate({ to: "/quizzes/$quizId", params: { quizId: quizId.current } });
        } catch (error) {
            setError(error instanceof Error ? error.message : "Could not import quiz.");
            setStatus(
                quizId.current
                    ? "Your quiz was created. Retry to open it."
                    : batchId.current
                      ? "Your import is saved. Retry to continue; imported questions will be reused."
                      : "",
            );
        } finally {
            setBusy(false);
        }
    }

    return (
        <div className="page-stack narrow">
            <Link to="/quizzes">← My Quizzes</Link>
            <header className="page-heading">
                <div>
                    <h1>Import quiz</h1>
                    <p className="muted">
                        Upload a quiz file, review its questions, and create a private quiz.
                    </p>
                </div>
            </header>
            <section className="panel form-grid">
                <h2>Choose a file</h2>
                <p className="muted">
                    Import 1–20 questions from a JSON file, up to 256 KiB. Simple quizzes use a
                    title and questions with a prompt and text answer. Answers ignore capitalization
                    and surrounding spaces.
                </p>
                <a href={`${import.meta.env.BASE_URL}sample-quiz.json`} download>
                    Download example quiz
                </a>
                <p className="muted small">
                    Existing question batch files are also supported, including multiple-choice
                    questions. Each question starts with 1 point and is required.
                </p>
                <label>
                    Quiz JSON file
                    <input
                        type="file"
                        accept=".json,application/json"
                        disabled={busy || reading}
                        onChange={(event) => void readFile(event.target.files?.[0])}
                    />
                </label>
                {reading ? <p role="status">Reading file…</p> : null}
            </section>
            {preview ? (
                <section className="panel form-grid">
                    <h2>{preview.artifact.topic}</h2>
                    {preview.description ? <p>{preview.description}</p> : null}
                    <p>{preview.artifact.questions.length} questions</p>
                    <ol>
                        {preview.artifact.questions.map((question) => (
                            <li key={question.key}>{question.content.prompt}</li>
                        ))}
                    </ol>
                    <p className="muted small">
                        Imported question content locks when added to the quiz. You can still add or
                        remove questions before taking the quiz.
                    </p>
                    <button
                        type="button"
                        disabled={busy || reading}
                        onClick={() => void importQuiz()}
                    >
                        {busy ? "Importing…" : "Import quiz"}
                    </button>
                </section>
            ) : null}
            {status ? <p role="status">{status}</p> : null}
            {error ? (
                <p role="alert" className="error-text">
                    {error}
                </p>
            ) : null}
        </div>
    );
}
