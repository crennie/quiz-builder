import { randomInt } from "node:crypto";

import {
    answerSnapshotSchema,
    attemptDetailSchema,
    attemptQuestionSnapshotsSchema,
    evaluationResultSchema,
    gradingSnapshotSchema,
    questionSnapshotSchema,
    scoreSummarySchema,
    settingsSnapshotSchema,
    userResponseSchema,
    type AttemptDetail,
    type Database,
    type UserResponse,
} from "@quiz-builder/contracts";

import { evaluateAnswer } from "../evaluation/deterministic.ts";
import { AppError } from "../errors/app-error.ts";
import { pool } from "./index.ts";
import type { QueryExecutor } from "./question-bank.ts";
import { withTransaction } from "./transaction.ts";

type AttemptRow = Database["public"]["Tables"]["quiz_attempts"]["Row"] & {
    quiz_id: string;
    quiz_title: string;
};
type AttemptQuestionRow = Database["public"]["Tables"]["quiz_attempt_questions"]["Row"] & {
    points_possible: string | number;
    points_awarded: string | number | null;
    required: boolean;
    time_limit_seconds: number | null;
};
type SourceQuestionRow = {
    id: string;
    question_id: string;
    question_version_id: string;
    position: number;
    points: string | number;
    prompt: string;
    question_type: Database["public"]["Enums"]["question_type"];
    answer_config: unknown;
    grading_config: unknown;
    explanation: string | null;
};

const iso = (value: string | Date): string => new Date(value).toISOString();

async function ownedAttempt(
    attemptId: string,
    userId: string,
    database: QueryExecutor,
    lock = false,
): Promise<AttemptRow> {
    const result = await database.query<AttemptRow>(
        `SELECT a.*, v.quiz_id, v.title AS quiz_title
         FROM public.quiz_attempts a JOIN public.quiz_versions v ON v.id = a.quiz_version_id
         WHERE a.id = $1 AND a.user_id = $2 ${lock ? "FOR UPDATE OF a" : ""}`,
        [attemptId, userId],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, "ATTEMPT_NOT_FOUND", "Attempt not found");
    return row;
}

async function mapAttempt(row: AttemptRow, database: QueryExecutor): Promise<AttemptDetail> {
    const settings = settingsSnapshotSchema.parse(row.settings_snapshot);
    const result = await database.query<AttemptQuestionRow>(
        `SELECT aq.*, m.required, m.time_limit_seconds
         FROM public.quiz_attempt_questions aq
         JOIN public.quiz_version_questions m ON m.id = aq.quiz_version_question_id
         WHERE aq.quiz_attempt_id = $1 ORDER BY aq.position`,
        [row.id],
    );
    const completed = row.status === "completed";
    return attemptDetailSchema.parse({
        id: row.id,
        quizId: row.quiz_id,
        quizVersionId: row.quiz_version_id,
        quizTitle: row.quiz_title,
        status: row.status,
        startedAt: iso(row.started_at),
        completedAt: row.completed_at ? iso(row.completed_at) : null,
        settings,
        scoreSummary:
            row.score_summary === null ? null : scoreSummarySchema.parse(row.score_summary),
        questions: result.rows.map((question) => {
            const snapshots = attemptQuestionSnapshotsSchema.parse({
                question: question.question_snapshot,
                answer: question.answer_snapshot,
                grading: question.grading_snapshot,
            });
            const evaluation =
                question.evaluation_result === null
                    ? null
                    : evaluationResultSchema.parse(question.evaluation_result);
            return {
                id: question.id,
                position: question.position,
                prompt: snapshots.question.prompt,
                questionType: snapshots.question.questionType,
                options:
                    snapshots.answer.questionType === "exact_text"
                        ? null
                        : snapshots.answer.options,
                required: question.required,
                timeLimitSeconds: question.time_limit_seconds,
                pointsPossible: Number(question.points_possible),
                userResponse:
                    question.user_response === null
                        ? null
                        : userResponseSchema.parse(question.user_response),
                pointsAwarded:
                    completed && question.points_awarded !== null
                        ? Number(question.points_awarded)
                        : null,
                evaluationResult:
                    completed && evaluation
                        ? {
                              ...evaluation,
                              explanation: settings.showAnswersAfterCompletion
                                  ? evaluation.explanation
                                  : null,
                          }
                        : null,
                correctAnswer:
                    completed && settings.showAnswersAfterCompletion ? snapshots.answer : null,
                explanation:
                    completed && settings.showAnswersAfterCompletion
                        ? snapshots.question.explanation
                        : null,
                answeredAt: question.answered_at ? iso(question.answered_at) : null,
            };
        }),
    });
}

export async function getAttempt(
    attemptId: string,
    userId: string,
    database: QueryExecutor = pool,
): Promise<AttemptDetail> {
    return mapAttempt(await ownedAttempt(attemptId, userId, database), database);
}

export async function startAttemptInTransaction(
    quizId: string,
    userId: string,
    database: QueryExecutor,
): Promise<AttemptDetail> {
    const quizzes = await database.query<{
        current_version_id: string | null;
        settings: unknown;
    }>(
        `SELECT q.current_version_id, v.settings FROM public.quizzes q
         JOIN public.quiz_versions v ON v.id = q.current_version_id
         WHERE q.id = $1 AND q.status = 'published'
           AND (q.created_by = $2 OR q.visibility IN ('public', 'unlisted'))
         FOR SHARE OF q`,
        [quizId, userId],
    );
    const quiz = quizzes.rows[0];
    if (!quiz?.current_version_id) throw new AppError(404, "QUIZ_NOT_FOUND", "Quiz not found");
    const settings = settingsSnapshotSchema.parse(quiz.settings);
    const sources = await database.query<SourceQuestionRow>(
        `SELECT m.id, m.question_id, m.question_version_id, m.position, m.points,
                qv.prompt, qv.question_type, qv.answer_config, qv.grading_config, qv.explanation
         FROM public.quiz_version_questions m
         JOIN public.question_versions qv ON qv.id = m.question_version_id
         WHERE m.quiz_version_id = $1 ORDER BY m.position`,
        [quiz.current_version_id],
    );
    if (sources.rows.length === 0) throw new AppError(409, "EMPTY_QUIZ", "Quiz has no questions");
    const attempts = await database.query<{ id: string }>(
        `INSERT INTO public.quiz_attempts (quiz_version_id, user_id, settings_snapshot)
         VALUES ($1, $2, $3::jsonb) RETURNING id`,
        [quiz.current_version_id, userId, JSON.stringify(settings)],
    );
    const attemptId = attempts.rows[0]?.id;
    if (!attemptId) throw new Error("Attempt insertion returned no row");
    const questions = [...sources.rows];
    if (settings.shuffleQuestions) {
        for (let index = questions.length - 1; index > 0; index--) {
            const swap = randomInt(index + 1);
            [questions[index], questions[swap]] = [questions[swap], questions[index]];
        }
    }
    for (const [position, source] of questions.entries()) {
        const snapshots = attemptQuestionSnapshotsSchema.parse({
            question: questionSnapshotSchema.parse({
                questionId: source.question_id,
                questionVersionId: source.question_version_id,
                prompt: source.prompt,
                questionType: source.question_type,
                explanation: source.explanation,
            }),
            answer: answerSnapshotSchema.parse(source.answer_config),
            grading: gradingSnapshotSchema.parse(source.grading_config),
        });
        await database.query(
            `INSERT INTO public.quiz_attempt_questions
               (quiz_attempt_id, quiz_version_question_id, position, question_snapshot,
                answer_snapshot, grading_snapshot, points_possible)
             VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7)`,
            [
                attemptId,
                source.id,
                position,
                JSON.stringify(snapshots.question),
                JSON.stringify(snapshots.answer),
                JSON.stringify(snapshots.grading),
                source.points,
            ],
        );
    }
    return getAttempt(attemptId, userId, database);
}

export function startAttempt(quizId: string, userId: string): Promise<AttemptDetail> {
    return withTransaction((client) => startAttemptInTransaction(quizId, userId, client));
}

export async function submitAnswerInTransaction(
    attemptId: string,
    questionId: string,
    userId: string,
    response: UserResponse,
    database: QueryExecutor,
): Promise<AttemptDetail> {
    const attempt = await ownedAttempt(attemptId, userId, database, true);
    if (attempt.status !== "in_progress") {
        throw new AppError(409, "ATTEMPT_CLOSED", "Attempt is no longer in progress");
    }
    const questions = await database.query<AttemptQuestionRow>(
        `SELECT * FROM public.quiz_attempt_questions WHERE id = $1 AND quiz_attempt_id = $2`,
        [questionId, attemptId],
    );
    const question = questions.rows[0];
    if (!question)
        throw new AppError(404, "ATTEMPT_QUESTION_NOT_FOUND", "Attempt question not found");
    if (question.answered_at !== null) {
        throw new AppError(409, "QUESTION_ALREADY_ANSWERED", "Question was already answered");
    }
    const snapshots = attemptQuestionSnapshotsSchema.parse({
        question: question.question_snapshot,
        answer: question.answer_snapshot,
        grading: question.grading_snapshot,
    });
    if (response.questionType !== snapshots.question.questionType) {
        throw new AppError(400, "RESPONSE_TYPE_MISMATCH", "Response type does not match question");
    }
    if (
        response.questionType === "multiple_choice_single" &&
        snapshots.answer.questionType === "multiple_choice_single" &&
        !snapshots.answer.options.some((option) => option.id === response.optionId)
    ) {
        throw new AppError(400, "INVALID_CHOICE", "Selected choice does not exist");
    }
    if (
        response.questionType === "multiple_choice_multi" &&
        snapshots.answer.questionType === "multiple_choice_multi"
    ) {
        const options = snapshots.answer.options;
        if (response.optionIds.some((id) => !options.some((option) => option.id === id))) {
            throw new AppError(400, "INVALID_CHOICE", "Selected choice does not exist");
        }
    }
    const evaluation = evaluateAnswer(snapshots, response, Number(question.points_possible));
    await database.query(
        `UPDATE public.quiz_attempt_questions
         SET user_response = $2::jsonb, evaluation_result = $3::jsonb,
             points_awarded = $4, started_at = COALESCE(started_at, now()), answered_at = now()
         WHERE id = $1`,
        [
            questionId,
            JSON.stringify(response),
            JSON.stringify(evaluation),
            evaluation.pointsAwarded,
        ],
    );
    return getAttempt(attemptId, userId, database);
}

export function submitAnswer(
    attemptId: string,
    questionId: string,
    userId: string,
    response: UserResponse,
): Promise<AttemptDetail> {
    return withTransaction((client) =>
        submitAnswerInTransaction(attemptId, questionId, userId, response, client),
    );
}

export async function completeAttemptInTransaction(
    attemptId: string,
    userId: string,
    database: QueryExecutor,
): Promise<AttemptDetail> {
    const attempt = await ownedAttempt(attemptId, userId, database, true);
    if (attempt.status !== "in_progress") {
        throw new AppError(409, "ATTEMPT_CLOSED", "Attempt is no longer in progress");
    }
    const questions = await database.query<AttemptQuestionRow>(
        `SELECT aq.*, m.required, m.time_limit_seconds
         FROM public.quiz_attempt_questions aq
         JOIN public.quiz_version_questions m ON m.id = aq.quiz_version_question_id
         WHERE aq.quiz_attempt_id = $1`,
        [attemptId],
    );
    if (questions.rows.some((question) => question.required && question.answered_at === null)) {
        throw new AppError(409, "REQUIRED_ANSWERS_MISSING", "Required questions must be answered");
    }
    const summary = scoreSummarySchema.parse({
        pointsPossible: questions.rows.reduce(
            (sum, question) => sum + Number(question.points_possible),
            0,
        ),
        pointsAwarded: questions.rows.reduce(
            (sum, question) => sum + Number(question.points_awarded ?? 0),
            0,
        ),
    });
    await database.query(
        `UPDATE public.quiz_attempts
         SET status = 'completed', completed_at = now(), score_summary = $2::jsonb
         WHERE id = $1`,
        [attemptId, JSON.stringify(summary)],
    );
    return getAttempt(attemptId, userId, database);
}

export function completeAttempt(attemptId: string, userId: string): Promise<AttemptDetail> {
    return withTransaction((client) => completeAttemptInTransaction(attemptId, userId, client));
}

export async function listAttempts(
    userId: string,
    options: { limit: number; offset: number },
    database: QueryExecutor = pool,
): Promise<{ items: AttemptDetail[]; nextOffset: number | null }> {
    const result = await database.query<AttemptRow>(
        `SELECT a.*, v.quiz_id, v.title AS quiz_title
         FROM public.quiz_attempts a JOIN public.quiz_versions v ON v.id = a.quiz_version_id
         WHERE a.user_id = $1 ORDER BY a.started_at DESC, a.id DESC LIMIT $2 OFFSET $3`,
        [userId, options.limit + 1, options.offset],
    );
    const items: AttemptDetail[] = [];
    for (const row of result.rows.slice(0, options.limit))
        items.push(await mapAttempt(row, database));
    return {
        items,
        nextOffset: result.rows.length > options.limit ? options.offset + options.limit : null,
    };
}
