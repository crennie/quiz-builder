import {
    createFeedbackBodySchema,
    feedbackListResponseSchema,
    feedbackSchema,
    type CreateFeedbackBody,
    type Database,
    type Feedback,
} from "@quiz-builder/contracts";

import { AppError } from "../errors/app-error.ts";
import { pool } from "./index.ts";
import type { QueryExecutor } from "./question-bank.ts";

type FeedbackRow = Database["public"]["Tables"]["feedback"]["Row"];

function mapFeedback(row: FeedbackRow): Feedback {
    return feedbackSchema.parse({
        id: row.id,
        submittedBy: row.submitted_by,
        questionId: row.question_id,
        quizId: row.quiz_id,
        quizAttemptQuestionId: row.quiz_attempt_question_id,
        category: row.category,
        comment: row.comment,
        status: row.status,
        createdAt: new Date(row.created_at).toISOString(),
        reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
    });
}

const reviewable = `
    EXISTS (SELECT 1 FROM public.questions q
            WHERE q.id = f.question_id AND q.created_by = $1)
    OR EXISTS (SELECT 1 FROM public.quizzes q
               WHERE q.id = f.quiz_id AND q.created_by = $1)
    OR EXISTS (
        SELECT 1 FROM public.quiz_attempt_questions aq
        JOIN public.quiz_version_questions m ON m.id = aq.quiz_version_question_id
        JOIN public.quiz_versions v ON v.id = m.quiz_version_id
        JOIN public.quizzes q ON q.id = v.quiz_id
        JOIN public.questions source ON source.id = m.question_id
        WHERE aq.id = f.quiz_attempt_question_id
          AND (q.created_by = $1 OR source.created_by = $1)
    )`;

export async function createFeedback(
    userId: string,
    input: CreateFeedbackBody,
    database: QueryExecutor = pool,
): Promise<Feedback> {
    const valid = createFeedbackBodySchema.parse(input);
    const target = valid.questionId
        ? {
              id: valid.questionId,
              condition: `EXISTS (
              SELECT 1 FROM public.questions q WHERE q.id = $1
                AND (q.created_by = $2 OR (q.status = 'published' AND q.visibility IN ('public', 'unlisted')))
          )`,
          }
        : valid.quizId
          ? {
                id: valid.quizId,
                condition: `EXISTS (
                SELECT 1 FROM public.quizzes q WHERE q.id = $1
                  AND (q.created_by = $2 OR (q.status = 'published' AND q.visibility IN ('public', 'unlisted')))
            )`,
            }
          : {
                id: valid.quizAttemptQuestionId,
                condition: `EXISTS (
                SELECT 1 FROM public.quiz_attempt_questions aq
                JOIN public.quiz_attempts a ON a.id = aq.quiz_attempt_id
                WHERE aq.id = $1 AND a.user_id = $2
            )`,
            };
    const result = await database.query<FeedbackRow>(
        `INSERT INTO public.feedback
           (submitted_by, question_id, quiz_id, quiz_attempt_question_id, category, comment)
         SELECT $2, $3::uuid, $4::uuid, $5::uuid,
                $6::public.feedback_category, $7
         WHERE ${target.condition}
         RETURNING *`,
        [
            target.id,
            userId,
            valid.questionId ?? null,
            valid.quizId ?? null,
            valid.quizAttemptQuestionId ?? null,
            valid.category,
            valid.comment,
        ],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, "FEEDBACK_TARGET_NOT_FOUND", "Feedback target not found");
    return mapFeedback(row);
}

export async function listReceivedFeedback(
    ownerId: string,
    options: { limit: number; offset: number },
    database: QueryExecutor = pool,
): Promise<{ items: Feedback[]; nextOffset: number | null }> {
    const result = await database.query<FeedbackRow>(
        `SELECT f.* FROM public.feedback f
         WHERE (${reviewable})
         ORDER BY f.created_at DESC, f.id DESC LIMIT $2 OFFSET $3`,
        [ownerId, options.limit + 1, options.offset],
    );
    return feedbackListResponseSchema.parse({
        items: result.rows.slice(0, options.limit).map(mapFeedback),
        nextOffset: result.rows.length > options.limit ? options.offset + options.limit : null,
    });
}

export async function updateFeedbackStatus(
    feedbackId: string,
    ownerId: string,
    status: Feedback["status"],
    database: QueryExecutor = pool,
): Promise<Feedback> {
    const result = await database.query<FeedbackRow>(
        `UPDATE public.feedback f
         SET status = $3::public.feedback_status,
             reviewed_at = CASE WHEN $3 = 'open' THEN NULL ELSE COALESCE(f.reviewed_at, now()) END
         WHERE f.id = $2 AND (${reviewable}) RETURNING f.*`,
        [ownerId, feedbackId, status],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, "FEEDBACK_NOT_FOUND", "Feedback not found");
    return mapFeedback(row);
}
