import {
    questionDetailSchema,
    questionListResponseSchema,
    questionVersionSchema,
    questionVersionContentSchema,
    tagListResponseSchema,
    tagSchema,
    type ContentStatus,
    type Database,
    type QuestionDetail,
    type QuestionVersion,
    type QuestionVersionContent,
    type Tag,
    type Visibility,
} from "@quiz-builder/contracts";
import type { PoolClient } from "pg";

import { AppError } from "../errors/app-error.ts";
import { pool } from "./index.ts";
import { withTransaction } from "./transaction.ts";

export type QueryExecutor = Pick<PoolClient, "query">;
type QuestionRow = Database["public"]["Tables"]["questions"]["Row"];
type VersionRow = Database["public"]["Tables"]["question_versions"]["Row"];
type TagRow = Database["public"]["Tables"]["tags"]["Row"];
type ListRow = QuestionRow & {
    version_id: string;
    version_number: number;
    prompt: string;
    question_type: Database["public"]["Enums"]["question_type"];
    answer_config: VersionRow["answer_config"];
    grading_config: VersionRow["grading_config"];
    explanation: string | null;
    version_created_by: string;
    version_created_at: string;
};
type QuestionTagRow = TagRow & { question_id: string };

function iso(value: string | Date): string {
    return new Date(value).toISOString();
}

function mapTag(row: TagRow): Tag {
    return tagSchema.parse({
        id: row.id,
        name: row.name,
        slug: row.slug,
        createdAt: iso(row.created_at),
    });
}

function parseVersionContent(row: VersionRow): QuestionVersionContent {
    return questionVersionContentSchema.parse({
        prompt: row.prompt,
        questionType: row.question_type,
        answerConfig: row.answer_config,
        gradingConfig: row.grading_config,
        explanation: row.explanation,
    });
}

function mapVersion(row: VersionRow): QuestionVersion {
    return questionVersionSchema.parse({
        ...parseVersionContent(row),
        id: row.id,
        versionNumber: row.version_number,
        createdBy: row.created_by,
        createdAt: iso(row.created_at),
    });
}

async function loadTags(
    questionIds: string[],
    database: QueryExecutor,
): Promise<Map<string, Tag[]>> {
    const result = new Map<string, Tag[]>();
    if (questionIds.length === 0) return result;

    const tags = await database.query<QuestionTagRow>(
        `SELECT qt.question_id, t.id, t.created_by, t.name, t.slug, t.created_at
         FROM public.question_tags qt
         JOIN public.tags t ON t.id = qt.tag_id
         WHERE qt.question_id = ANY($1::uuid[])
         ORDER BY t.name, t.id`,
        [questionIds],
    );

    for (const row of tags.rows) {
        const values = result.get(row.question_id) ?? [];
        values.push(mapTag(row));
        result.set(row.question_id, values);
    }

    return result;
}

export async function getQuestionDetail(
    questionId: string,
    viewerId: string | null,
    database: QueryExecutor = pool,
): Promise<QuestionDetail | null> {
    const questions = await database.query<QuestionRow>(
        `SELECT * FROM public.questions q
         WHERE q.id = $1
           AND (q.created_by = $2::uuid OR
                (q.status = 'published' AND q.visibility IN ('public', 'unlisted')))`,
        [questionId, viewerId],
    );
    const question = questions.rows[0];
    if (!question) return null;
    if (!question.current_version_id) throw new Error("Question has no current version");

    const versions = await database.query<VersionRow>(
        `SELECT * FROM public.question_versions
         WHERE id = $1 AND question_id = $2`,
        [question.current_version_id, question.id],
    );
    const version = versions.rows[0];
    if (!version) throw new Error("Current question version was not found");

    const tags = (await loadTags([question.id], database)).get(question.id) ?? [];
    const base = {
        id: question.id,
        createdBy: question.created_by,
        visibility: question.visibility,
        status: question.status,
        createdAt: iso(question.created_at),
        updatedAt: iso(question.updated_at),
        tags,
    };

    return questionDetailSchema.parse({
        ...base,
        isOwner: question.created_by === viewerId,
        currentVersion: mapVersion(version),
    });
}

export async function listQuestions(
    options: { viewerId: string | null; tagSlug?: string; limit: number; offset: number },
    database: QueryExecutor = pool,
): Promise<{ items: QuestionDetail[]; nextOffset: number | null }> {
    const rows = await database.query<ListRow>(
        `SELECT q.*, v.id AS version_id, v.version_number, v.prompt, v.question_type,
                v.answer_config, v.grading_config, v.explanation,
                v.created_by AS version_created_by, v.created_at AS version_created_at
         FROM public.questions q
         JOIN public.question_versions v ON v.id = q.current_version_id
         WHERE (q.created_by = $1::uuid OR
                (q.visibility = 'public' AND q.status = 'published'))
           AND ($2::text IS NULL OR EXISTS (
             SELECT 1 FROM public.question_tags qt
             JOIN public.tags t ON t.id = qt.tag_id
             WHERE qt.question_id = q.id AND t.slug = $2
           ))
         ORDER BY q.created_at DESC, q.id DESC
         LIMIT $3 OFFSET $4`,
        [options.viewerId, options.tagSlug ?? null, options.limit + 1, options.offset],
    );
    const selected = rows.rows.slice(0, options.limit);
    const tags = await loadTags(
        selected.map((row) => row.id),
        database,
    );

    const items = selected.map((row) =>
        questionDetailSchema.parse({
            id: row.id,
            createdBy: row.created_by,
            visibility: row.visibility,
            status: row.status,
            createdAt: iso(row.created_at),
            updatedAt: iso(row.updated_at),
            isOwner: row.created_by === options.viewerId,
            tags: tags.get(row.id) ?? [],
            currentVersion: mapVersion({
                id: row.version_id,
                question_id: row.id,
                version_number: row.version_number,
                prompt: row.prompt,
                question_type: row.question_type,
                answer_config: row.answer_config,
                grading_config: row.grading_config,
                explanation: row.explanation,
                created_by: row.version_created_by,
                created_at: row.version_created_at,
            }),
        }),
    );

    return questionListResponseSchema.parse({
        items,
        nextOffset: rows.rows.length > options.limit ? options.offset + options.limit : null,
    });
}

export async function getQuestionVersions(
    questionId: string,
    ownerId: string,
    database: QueryExecutor = pool,
): Promise<QuestionVersion[]> {
    const owned = await database.query<{ id: string }>(
        `SELECT id FROM public.questions WHERE id = $1 AND created_by = $2`,
        [questionId, ownerId],
    );
    if (!owned.rows[0]) throw new AppError(404, "QUESTION_NOT_FOUND", "Question not found");

    const versions = await database.query<VersionRow>(
        `SELECT * FROM public.question_versions
         WHERE question_id = $1 ORDER BY version_number DESC`,
        [questionId],
    );
    return versions.rows.map(mapVersion);
}

export async function createQuestionInTransaction(
    ownerId: string,
    input: {
        content: QuestionVersionContent;
        visibility: Visibility;
        status: "draft" | "published";
    },
    database: QueryExecutor,
): Promise<QuestionDetail> {
    const content = questionVersionContentSchema.parse(input.content);
    const questions = await database.query<QuestionRow>(
        `INSERT INTO public.questions (created_by, visibility, status)
         VALUES ($1, $2, $3) RETURNING *`,
        [ownerId, input.visibility, input.status],
    );
    const question = questions.rows[0];
    if (!question) throw new Error("Question insertion returned no row");

    const versions = await database.query<VersionRow>(
        `INSERT INTO public.question_versions
           (question_id, version_number, prompt, question_type, answer_config,
            grading_config, explanation, created_by)
         VALUES ($1, 1, $2, $3, $4::jsonb, $5::jsonb, $6, $7)
         RETURNING *`,
        [
            question.id,
            content.prompt,
            content.questionType,
            JSON.stringify(content.answerConfig),
            JSON.stringify(content.gradingConfig),
            content.explanation,
            ownerId,
        ],
    );
    const version = versions.rows[0];
    if (!version) throw new Error("Question version insertion returned no row");

    await database.query(
        `UPDATE public.questions SET current_version_id = $1, updated_at = now()
         WHERE id = $2`,
        [version.id, question.id],
    );
    const detail = await getQuestionDetail(question.id, ownerId, database);
    if (!detail) throw new Error("Created question was not found");
    return detail;
}

export function createQuestion(
    ownerId: string,
    input: {
        content: QuestionVersionContent;
        visibility: Visibility;
        status: "draft" | "published";
    },
): Promise<QuestionDetail> {
    return withTransaction((client) => createQuestionInTransaction(ownerId, input, client));
}

export async function createQuestionVersionInTransaction(
    questionId: string,
    ownerId: string,
    content: QuestionVersionContent,
    database: QueryExecutor,
): Promise<QuestionDetail> {
    const validatedContent = questionVersionContentSchema.parse(content);
    const questions = await database.query<QuestionRow>(
        `SELECT * FROM public.questions
         WHERE id = $1 AND created_by = $2 FOR UPDATE`,
        [questionId, ownerId],
    );
    const question = questions.rows[0];
    if (!question) throw new AppError(404, "QUESTION_NOT_FOUND", "Question not found");
    if (question.status === "archived") {
        throw new AppError(409, "QUESTION_ARCHIVED", "Archived questions cannot be revised");
    }
    if (!question.current_version_id) throw new Error("Question has no current version");

    const current = await database.query<{ version_number: number }>(
        `SELECT version_number FROM public.question_versions WHERE id = $1`,
        [question.current_version_id],
    );
    const currentVersion = current.rows[0];
    if (!currentVersion) throw new Error("Current question version was not found");

    const versions = await database.query<VersionRow>(
        `INSERT INTO public.question_versions
           (question_id, version_number, prompt, question_type, answer_config,
            grading_config, explanation, created_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
         RETURNING *`,
        [
            questionId,
            currentVersion.version_number + 1,
            validatedContent.prompt,
            validatedContent.questionType,
            JSON.stringify(validatedContent.answerConfig),
            JSON.stringify(validatedContent.gradingConfig),
            validatedContent.explanation,
            ownerId,
        ],
    );
    const version = versions.rows[0];
    if (!version) throw new Error("Question version insertion returned no row");

    await database.query(
        `UPDATE public.questions SET current_version_id = $1, updated_at = now()
         WHERE id = $2`,
        [version.id, questionId],
    );
    const detail = await getQuestionDetail(questionId, ownerId, database);
    if (!detail) throw new Error("Revised question was not found");
    return detail;
}

export function createQuestionVersion(
    questionId: string,
    ownerId: string,
    content: QuestionVersionContent,
): Promise<QuestionDetail> {
    return withTransaction((client) =>
        createQuestionVersionInTransaction(questionId, ownerId, content, client),
    );
}

export async function updateQuestionMetadataInTransaction(
    questionId: string,
    ownerId: string,
    metadata: { visibility?: Visibility; status?: ContentStatus },
    database: QueryExecutor,
): Promise<QuestionDetail> {
    const updated = await database.query<QuestionRow>(
        `UPDATE public.questions
         SET visibility = COALESCE($3::public.content_visibility, visibility),
             status = COALESCE($4::public.content_status, status),
             updated_at = now()
         WHERE id = $1 AND created_by = $2
         RETURNING *`,
        [questionId, ownerId, metadata.visibility ?? null, metadata.status ?? null],
    );
    if (!updated.rows[0]) throw new AppError(404, "QUESTION_NOT_FOUND", "Question not found");
    const detail = await getQuestionDetail(questionId, ownerId, database);
    if (!detail) throw new Error("Updated question was not found");
    return detail;
}

export function updateQuestionMetadata(
    questionId: string,
    ownerId: string,
    metadata: { visibility?: Visibility; status?: ContentStatus },
): Promise<QuestionDetail> {
    return withTransaction((client) =>
        updateQuestionMetadataInTransaction(questionId, ownerId, metadata, client),
    );
}

function slugify(name: string): string {
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
