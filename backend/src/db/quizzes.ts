import { isDeepStrictEqual } from "node:util";
import {
    quizContentSchema,
    quizDetailSchema,
    quizListResponseSchema,
    quizSettingsSchema,
    tagSchema,
    type Database,
    type QuizContent,
    type QuizDetail,
    type Tag,
} from "@quiz-builder/contracts";
import { AppError } from "../errors/app-error.ts";
import { pool } from "./index.ts";
import { questionContent, type QueryExecutor } from "./question-bank.ts";
import { withTransaction } from "./transaction.ts";
type QuizRow = Database["public"]["Tables"]["quizzes"]["Row"];
type QuestionRow = Database["public"]["Tables"]["questions"]["Row"];
type MemberRow = QuestionRow & {
    membership_id: string;
    question_id: string;
    position: number;
    points: string | number;
    required: boolean;
    time_limit_seconds: number | null;
};
type TagRow = Database["public"]["Tables"]["tags"]["Row"];
const iso = (value: string | Date): string => new Date(value).toISOString();
async function mapDetail(
    row: QuizRow,
    viewerId: string | null,
    database: QueryExecutor,
): Promise<QuizDetail> {
    const members = await database.query<MemberRow>(
        `SELECT q.*,m.id AS membership_id,m.question_id,m.position,m.points,m.required,m.time_limit_seconds
 FROM public.quiz_questions m JOIN public.questions q ON q.id=m.question_id WHERE m.quiz_id=$1 ORDER BY m.position`,
        [row.id],
    );
    const tags = await database.query<TagRow>(
        `SELECT t.* FROM public.tags t JOIN public.quiz_tags qt ON qt.tag_id=t.id WHERE qt.quiz_id=$1 ORDER BY t.name,t.id`,
        [row.id],
    );
    const attempts = await database.query<{ exists: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM public.quiz_attempts WHERE quiz_id=$1) AS exists`,
        [row.id],
    );
    const isOwner = row.created_by === viewerId;
    return quizDetailSchema.parse({
        id: row.id,
        createdBy: row.created_by,
        visibility: row.visibility,
        title: row.title,
        description: row.description,
        settings: quizSettingsSchema.parse(row.settings),
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
        archivedAt: row.archived_at ? iso(row.archived_at) : null,
        isOwner,
        canEditContent:
            isOwner &&
            row.visibility === "private" &&
            !row.archived_at &&
            !attempts.rows[0]?.exists,
        tags: tags.rows.map((t): Tag =>
            tagSchema.parse({ id: t.id, name: t.name, slug: t.slug, createdAt: iso(t.created_at) }),
        ),
        questions: members.rows.map((m) => ({
            id: m.membership_id,
            questionId: m.question_id,
            position: m.position,
            points: Number(m.points),
            required: m.required,
            timeLimitSeconds: m.time_limit_seconds,
            question: questionContent(m),
        })),
    });
}
export async function getQuizDetail(
    quizId: string,
    viewerId: string | null,
    database: QueryExecutor = pool,
): Promise<QuizDetail | null> {
    const result = await database.query<QuizRow>(
        `SELECT * FROM public.quizzes WHERE id=$1 AND (created_by=$2::uuid OR visibility='public')`,
        [quizId, viewerId],
    );
    return result.rows[0] ? mapDetail(result.rows[0], viewerId, database) : null;
}
export async function listQuizzes(
    options: {
        viewerId: string | null;
        scope?: "all" | "mine";
        tagSlug?: string;
        archived?: boolean;
        limit: number;
        offset: number;
    },
    database: QueryExecutor = pool,
) {
    const rows = await database.query<QuizRow>(
        `SELECT q.* FROM public.quizzes q WHERE (q.created_by=$1::uuid OR ($5::text='all' AND q.visibility='public'))
 AND NOT EXISTS(SELECT 1 FROM public.lesson_quizzes lq WHERE lq.quiz_id=q.id)
 AND (($6::boolean AND q.archived_at IS NOT NULL AND q.created_by=$1::uuid) OR (NOT $6::boolean AND q.archived_at IS NULL))
 AND ($2::text IS NULL OR EXISTS(SELECT 1 FROM public.quiz_tags qt JOIN public.tags t ON t.id=qt.tag_id WHERE qt.quiz_id=q.id AND t.slug=$2))
 ORDER BY q.created_at DESC,q.id DESC LIMIT $3 OFFSET $4`,
        [
            options.viewerId,
            options.tagSlug ?? null,
            options.limit + 1,
            options.offset,
            options.scope ?? "all",
            options.archived ?? false,
        ],
    );
    const items: QuizDetail[] = [];
    for (const row of rows.rows.slice(0, options.limit))
        items.push(await mapDetail(row, options.viewerId, database));
    return quizListResponseSchema.parse({
        items,
        nextOffset: rows.rows.length > options.limit ? options.offset + options.limit : null,
    });
}
async function checkQuestions(ownerId: string, content: QuizContent, database: QueryExecutor) {
    // Lock each distinct source in stable order after acquiring the parent quiz lock.
    for (const id of [...new Set(content.questions.map((q) => q.questionId))].sort()) {
        const result = await database.query<{ id: string }>(
            `SELECT id FROM public.questions WHERE id=$1 AND (created_by=$2 OR visibility='public') FOR UPDATE`,
            [id, ownerId],
        );
        if (!result.rows[0])
            throw new AppError(404, "QUESTION_NOT_FOUND", "Question not available");
    }
}
async function insertComposition(quizId: string, content: QuizContent, database: QueryExecutor) {
    for (const [position, q] of content.questions.entries())
        await database.query(
            `INSERT INTO public.quiz_questions(quiz_id,question_id,position,points,required,time_limit_seconds)
 VALUES($1,$2,$3,$4,$5,$6)`,
            [quizId, q.questionId, position, q.points, q.required, q.timeLimitSeconds],
        );
}
export async function createQuizInTransaction(
    ownerId: string,
    input: { content: QuizContent },
    database: QueryExecutor,
): Promise<QuizDetail> {
    const content = quizContentSchema.parse(input.content);
    const result = await database.query<{ id: string }>(
        `INSERT INTO public.quizzes(created_by,title,description,settings) VALUES($1,$2,$3,$4::jsonb) RETURNING id`,
        [ownerId, content.title, content.description, JSON.stringify(content.settings)],
    );
    const id = result.rows[0]?.id;
    if (!id) throw new Error("Quiz insertion returned no row");
    await checkQuestions(ownerId, content, database);
    await insertComposition(id, content, database);
    const detail = await getQuizDetail(id, ownerId, database);
    if (!detail) throw new Error("Created quiz was not found");
    return detail;
}
export function createQuiz(ownerId: string, input: { content: QuizContent }) {
    return withTransaction((c) => createQuizInTransaction(ownerId, input, c));
}
export async function saveQuizContentInTransaction(
    quizId: string,
    ownerId: string,
    submitted: QuizContent,
    database: QueryExecutor,
): Promise<QuizDetail> {
    const content = quizContentSchema.parse(submitted);
    const result = await database.query<QuizRow>(
        `SELECT * FROM public.quizzes WHERE id=$1 AND created_by=$2 FOR UPDATE`,
        [quizId, ownerId],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, "QUIZ_NOT_FOUND", "Quiz not found");
    if (row.visibility !== "private")
        throw new AppError(
            403,
            "PUBLIC_CONTENT_READ_ONLY",
            "Public content cannot be edited through this API",
        );
    const current = await mapDetail(row, ownerId, database);
    const comparable = quizContentSchema.parse({
        title: current.title,
        description: current.description,
        settings: current.settings,
        questions: current.questions.map(({ questionId, points, required, timeLimitSeconds }) => ({
            questionId,
            points,
            required,
            timeLimitSeconds,
        })),
    });
    if (isDeepStrictEqual(content, comparable)) return current;
    if (row.archived_at)
        throw new AppError(409, "QUIZ_ARCHIVED", "Restore this quiz before editing its content");
    if (!current.canEditContent)
        throw new AppError(
            409,
            "QUIZ_CONTENT_LOCKED",
            "Attempted quizzes require a new quiz record",
        );
    await checkQuestions(ownerId, content, database);
    await database.query(
        `UPDATE public.quizzes SET title=$2,description=$3,settings=$4::jsonb,updated_at=now() WHERE id=$1`,
        [quizId, content.title, content.description, JSON.stringify(content.settings)],
    );
    await database.query(`DELETE FROM public.quiz_questions WHERE quiz_id=$1`, [quizId]);
    await insertComposition(quizId, content, database);
    const detail = await getQuizDetail(quizId, ownerId, database);
    if (!detail) throw new Error("Saved quiz was not found");
    return detail;
}
export function saveQuizContent(quizId: string, ownerId: string, content: QuizContent) {
    return withTransaction((c) => saveQuizContentInTransaction(quizId, ownerId, content, c));
}
async function assertOwnedQuizAndTag(
    quizId: string,
    tagId: string,
    ownerId: string,
    database: QueryExecutor,
): Promise<void> {
    const quiz = await database.query<{ id: string }>(
        `SELECT id FROM public.quizzes WHERE id = $1 AND created_by = $2 FOR UPDATE`,
        [quizId, ownerId],
    );
    if (!quiz.rows[0]) throw new AppError(404, "QUIZ_NOT_FOUND", "Quiz not found");
    const tag = await database.query<{ id: string }>(
        `SELECT id FROM public.tags WHERE id = $1 AND created_by = $2`,
        [tagId, ownerId],
    );
    if (!tag.rows[0]) throw new AppError(404, "TAG_NOT_FOUND", "Tag not found");
}

export async function assignQuizTagInTransaction(
    quizId: string,
    tagId: string,
    ownerId: string,
    database: QueryExecutor,
): Promise<QuizDetail> {
    await assertOwnedQuizAndTag(quizId, tagId, ownerId, database);
    await database.query(
        `INSERT INTO public.quiz_tags (quiz_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [quizId, tagId],
    );
    const detail = await getQuizDetail(quizId, ownerId, database);
    if (!detail) throw new Error("Tagged quiz was not found");
    return detail;
}

export function assignQuizTag(quizId: string, tagId: string, ownerId: string): Promise<QuizDetail> {
    return withTransaction((client) => assignQuizTagInTransaction(quizId, tagId, ownerId, client));
}

export async function removeQuizTagInTransaction(
    quizId: string,
    tagId: string,
    ownerId: string,
    database: QueryExecutor,
): Promise<void> {
    await assertOwnedQuizAndTag(quizId, tagId, ownerId, database);
    await database.query(`DELETE FROM public.quiz_tags WHERE quiz_id = $1 AND tag_id = $2`, [
        quizId,
        tagId,
    ]);
}

export function removeQuizTag(quizId: string, tagId: string, ownerId: string): Promise<void> {
    return withTransaction((client) => removeQuizTagInTransaction(quizId, tagId, ownerId, client));
}

export function setQuizArchived(
    quizId: string,
    ownerId: string,
    archived: boolean,
): Promise<QuizDetail> {
    return withTransaction(async (database) => {
        const result = await database.query<QuizRow>(
            `SELECT * FROM public.quizzes WHERE id=$1 AND created_by=$2 FOR UPDATE`,
            [quizId, ownerId],
        );
        const quiz = result.rows[0];
        if (!quiz) throw new AppError(404, "QUIZ_NOT_FOUND", "Quiz not found");
        if (quiz.visibility !== "private") {
            throw new AppError(
                403,
                "PUBLIC_CONTENT_READ_ONLY",
                "Public quizzes cannot be archived through this API",
            );
        }
        await database.query(
            `UPDATE public.quizzes SET archived_at=CASE WHEN $2::boolean THEN COALESCE(archived_at, now()) ELSE NULL END,
             updated_at=CASE WHEN (archived_at IS NOT NULL)=$2::boolean THEN updated_at ELSE now() END WHERE id=$1`,
            [quizId, archived],
        );
        const detail = await getQuizDetail(quizId, ownerId, database);
        if (!detail) throw new Error("Archived quiz was not found");
        return detail;
    });
}
