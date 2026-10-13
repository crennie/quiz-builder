import { PGlite } from "@electric-sql/pglite";
import type { QuestionContent, QuizContent } from "@quiz-builder/contracts";
import { applyMigrations } from "./apply-migrations.ts";
import { createQuestionInTransaction, type QueryExecutor } from "../../src/db/question-bank.ts";
import { createQuizInTransaction } from "../../src/db/quizzes.ts";
export const owner = "00000000-0000-4000-8000-000000000101";
export const other = "00000000-0000-4000-8000-000000000102";
export const third = "00000000-0000-4000-8000-000000000103";
export const content: QuestionContent = {
    prompt: "Capital of France?",
    questionType: "exact_text",
    answerConfig: { questionType: "exact_text", acceptedAnswers: ["Paris"] },
    gradingConfig: { questionType: "exact_text", caseSensitive: false, trimWhitespace: true },
    explanation: "Paris is the capital.",
};
export async function testDatabase() {
    const db = new PGlite();
    await db.exec("CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY)");
    await applyMigrations((s) => db.exec(s));
    for (const id of [owner, other, third]) {
        await db.query("INSERT INTO auth.users(id) VALUES($1)", [id]);
        await db.query("INSERT INTO public.profiles(id,display_name) VALUES($1,'Tester')", [id]);
    }
    return { db, sql: db as unknown as QueryExecutor };
}
export async function transaction<T>(db: PGlite, work: () => Promise<T>): Promise<T> {
    await db.exec("BEGIN");
    try {
        const value = await work();
        await db.exec("COMMIT");
        return value;
    } catch (e) {
        await db.exec("ROLLBACK");
        throw e;
    }
}
export function quizContent(questionId: string): QuizContent {
    return {
        title: "Geography",
        description: null,
        settings: { shuffleQuestions: false, showAnswersAfterCompletion: true },
        questions: [{ questionId, points: 2.5, required: true, timeLimitSeconds: 30 }],
    };
}
export async function fixture(sql: QueryExecutor) {
    const question = await createQuestionInTransaction(owner, { content }, sql);
    const input = quizContent(question.id);
    const quiz = await createQuizInTransaction(owner, { content: input }, sql);
    return { question, quiz, input };
}
