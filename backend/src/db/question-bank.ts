import {
    questionContentSchema,
    questionDetailSchema,
    questionListResponseSchema,
    tagSchema,
    tagListResponseSchema,
    type QuestionContent,
    type QuestionDetail,
    type Database,
    type Tag,
} from "@quiz-builder/contracts";
import type { PoolClient } from "pg";
import { isDeepStrictEqual } from "node:util";
import { AppError } from "../errors/app-error.ts";
import { pool } from "./index.ts";
import { withTransaction } from "./transaction.ts";
export type QueryExecutor = Pick<PoolClient, "query">;
type QuestionRow = Database["public"]["Tables"]["questions"]["Row"];
type TagRow = Database["public"]["Tables"]["tags"]["Row"];
const iso = (value: string | Date): string => new Date(value).toISOString();
function mapTag(row: TagRow): Tag {
    return tagSchema.parse({
        id: row.id,
        name: row.name,
        slug: row.slug,
        createdAt: iso(row.created_at),
    });
}
export function questionContent(row: QuestionRow): QuestionContent {
    return questionContentSchema.parse({
        prompt: row.prompt,
        questionType: row.question_type,
        answerConfig: row.answer_config,
        gradingConfig: row.grading_config,
        explanation: row.explanation,
    });
}
async function mapDetail(
    row: QuestionRow,
    viewerId: string | null,
    database: QueryExecutor,
): Promise<QuestionDetail> {
    const tags = await database.query<TagRow>(
        `SELECT t.* FROM public.tags t JOIN public.question_tags qt ON qt.tag_id=t.id
 WHERE qt.question_id=$1 ORDER BY t.name,t.id`,
        [row.id],
    );
    const isOwner = row.created_by === viewerId;
    return questionDetailSchema.parse({
        ...questionContent(row),
        id: row.id,
        createdBy: row.created_by,
        visibility: row.visibility,
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
        contentLockedAt: row.content_locked_at ? iso(row.content_locked_at) : null,
        isOwner,
        canEditContent: isOwner && row.visibility === "private" && row.content_locked_at === null,
        tags: tags.rows.map(mapTag),
    });
}
export async function getQuestionDetail(
    questionId: string,
    viewerId: string | null,
    database: QueryExecutor = pool,
): Promise<QuestionDetail | null> {
    const result = await database.query<QuestionRow>(
        `SELECT * FROM public.questions WHERE id=$1 AND (created_by=$2::uuid OR visibility='public')`,
        [questionId, viewerId],
    );
    return result.rows[0] ? mapDetail(result.rows[0], viewerId, database) : null;
}
export async function listManagedQuestions(
    options: { ownerId: string; tagSlug?: string; limit: number; offset: number },
    database: QueryExecutor = pool,
) {
    const result = await database.query<QuestionRow>(
        `SELECT q.* FROM public.questions q WHERE q.created_by=$1
 AND ($2::text IS NULL OR EXISTS(SELECT 1 FROM public.question_tags qt JOIN public.tags t ON t.id=qt.tag_id WHERE qt.question_id=q.id AND t.slug=$2))
 ORDER BY q.created_at DESC,q.id DESC LIMIT $3 OFFSET $4`,
        [options.ownerId, options.tagSlug ?? null, options.limit + 1, options.offset],
    );
    const items: QuestionDetail[] = [];
    for (const row of result.rows.slice(0, options.limit))
        items.push(await mapDetail(row, options.ownerId, database));
    return questionListResponseSchema.parse({
        items,
        nextOffset: result.rows.length > options.limit ? options.offset + options.limit : null,
    });
}
export async function createQuestionInTransaction(
    ownerId: string,
    input: { content: QuestionContent },
    database: QueryExecutor,
): Promise<QuestionDetail> {
    const content = questionContentSchema.parse(input.content);
    const result = await database.query<QuestionRow>(
        `INSERT INTO public.questions(created_by,prompt,question_type,answer_config,grading_config,explanation)
 VALUES($1,$2,$3,$4::jsonb,$5::jsonb,$6) RETURNING *`,
        [
            ownerId,
            content.prompt,
            content.questionType,
            JSON.stringify(content.answerConfig),
            JSON.stringify(content.gradingConfig),
            content.explanation,
        ],
    );
    if (!result.rows[0]) throw new Error("Question insertion returned no row");
    return mapDetail(result.rows[0], ownerId, database);
}
export function createQuestion(ownerId: string, input: { content: QuestionContent }) {
    return withTransaction((client) => createQuestionInTransaction(ownerId, input, client));
}
export async function saveQuestionContentInTransaction(
    questionId: string,
    ownerId: string,
    submitted: QuestionContent,
    database: QueryExecutor,
): Promise<QuestionDetail> {
    const content = questionContentSchema.parse(submitted);
    const result = await database.query<QuestionRow>(
        `SELECT * FROM public.questions WHERE id=$1 AND created_by=$2 FOR UPDATE`,
        [questionId, ownerId],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, "QUESTION_NOT_FOUND", "Question not found");
    if (row.visibility !== "private")
        throw new AppError(
            403,
            "PUBLIC_CONTENT_READ_ONLY",
            "Public content cannot be edited through this API",
        );
    if (!isDeepStrictEqual(content, questionContent(row))) {
        if (row.content_locked_at !== null)
            throw new AppError(
                409,
                "QUESTION_CONTENT_LOCKED",
                "Used questions require a new question record",
            );
        await database.query(
            `UPDATE public.questions SET prompt=$2,question_type=$3,answer_config=$4::jsonb,grading_config=$5::jsonb,explanation=$6,updated_at=now() WHERE id=$1`,
            [
                questionId,
                content.prompt,
                content.questionType,
                JSON.stringify(content.answerConfig),
                JSON.stringify(content.gradingConfig),
                content.explanation,
            ],
        );
    }
    const detail = await getQuestionDetail(questionId, ownerId, database);
    if (!detail) throw new Error("Saved question was not found");
    return detail;
}
export function saveQuestionContent(questionId: string, ownerId: string, content: QuestionContent) {
    return withTransaction((client) =>
        saveQuestionContentInTransaction(questionId, ownerId, content, client),
    );
}
export function slugify(name: string): string {
    return name
        .normalize("NFKC")
        .toLocaleLowerCase("en")
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-|-$/g, "");
}

export async function createTag(
    ownerId: string,
    name: string,
    database: QueryExecutor = pool,
): Promise<Tag> {
    const slug = slugify(name);
    if (!slug)
        throw new AppError(400, "VALIDATION_ERROR", "Tag name must contain a letter or number");

    const tags = await database.query<TagRow>(
        `INSERT INTO public.tags (created_by, name, slug)
         VALUES ($1, $2, $3)
         ON CONFLICT (created_by, slug) DO NOTHING
         RETURNING *`,
        [ownerId, name, slug],
    );
    const tag = tags.rows[0];
    if (!tag) throw new AppError(409, "TAG_ALREADY_EXISTS", "A tag with this slug already exists");
    return mapTag(tag);
}

export async function listTags(ownerId: string, database: QueryExecutor = pool): Promise<Tag[]> {
    const tags = await database.query<TagRow>(
        `SELECT * FROM public.tags
         WHERE created_by = $1 ORDER BY name, id`,
        [ownerId],
    );
    return tagListResponseSchema.parse({ tags: tags.rows.map(mapTag) }).tags;
}

async function assertOwnedQuestionAndTag(
    questionId: string,
    tagId: string,
    ownerId: string,
    database: QueryExecutor,
): Promise<void> {
    const question = await database.query<{ id: string }>(
        `SELECT id FROM public.questions
         WHERE id = $1 AND created_by = $2 FOR UPDATE`,
        [questionId, ownerId],
    );
    if (!question.rows[0]) throw new AppError(404, "QUESTION_NOT_FOUND", "Question not found");

    const tag = await database.query<{ id: string }>(
        `SELECT id FROM public.tags WHERE id = $1 AND created_by = $2`,
        [tagId, ownerId],
    );
    if (!tag.rows[0]) throw new AppError(404, "TAG_NOT_FOUND", "Tag not found");
}

export async function assignQuestionTagInTransaction(
    questionId: string,
    tagId: string,
    ownerId: string,
    database: QueryExecutor,
): Promise<QuestionDetail> {
    await assertOwnedQuestionAndTag(questionId, tagId, ownerId, database);
    await database.query(
        `INSERT INTO public.question_tags (question_id, tag_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [questionId, tagId],
    );
    const detail = await getQuestionDetail(questionId, ownerId, database);
    if (!detail) throw new Error("Tagged question was not found");
    return detail;
}

export function assignQuestionTag(
    questionId: string,
    tagId: string,
    ownerId: string,
): Promise<QuestionDetail> {
    return withTransaction((client) =>
        assignQuestionTagInTransaction(questionId, tagId, ownerId, client),
    );
}

export async function removeQuestionTagInTransaction(
    questionId: string,
    tagId: string,
    ownerId: string,
    database: QueryExecutor,
): Promise<void> {
    await assertOwnedQuestionAndTag(questionId, tagId, ownerId, database);
    await database.query(
        `DELETE FROM public.question_tags WHERE question_id = $1 AND tag_id = $2`,
        [questionId, tagId],
    );
}

export function removeQuestionTag(
    questionId: string,
    tagId: string,
    ownerId: string,
): Promise<void> {
    return withTransaction((client) =>
        removeQuestionTagInTransaction(questionId, tagId, ownerId, client),
    );
}
