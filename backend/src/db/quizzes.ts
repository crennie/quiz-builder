import {
    quizContentSchema,
    quizDetailSchema,
    quizListResponseSchema,
    quizSettingsSchema,
    quizVersionSchema,
    questionVersionContentSchema,
    tagSchema,
    type ContentStatus,
    type Database,
    type QuizContent,
    type QuizDetail,
    type QuizVersion,
    type Tag,
    type Visibility,
} from "@quiz-builder/contracts";

import { AppError } from "../errors/app-error.ts";
import { pool } from "./index.ts";
import type { QueryExecutor } from "./question-bank.ts";
import { withTransaction } from "./transaction.ts";

type QuizRow = Database["public"]["Tables"]["quizzes"]["Row"];
type QuizVersionRow = Database["public"]["Tables"]["quiz_versions"]["Row"];
type MembershipRow = Omit<
    Database["public"]["Tables"]["quiz_version_questions"]["Row"],
    "points"
> & {
    points: string | number;
    prompt: string;
    question_type: Database["public"]["Enums"]["question_type"];
    answer_config: Database["public"]["Tables"]["question_versions"]["Row"]["answer_config"];
    grading_config: Database["public"]["Tables"]["question_versions"]["Row"]["grading_config"];
    explanation: string | null;
};
type TagRow = Database["public"]["Tables"]["tags"]["Row"] & { quiz_id: string };

const iso = (value: string | Date): string => new Date(value).toISOString();

function mapTag(row: TagRow): Tag {
    return tagSchema.parse({
        id: row.id,
        name: row.name,
        slug: row.slug,
        createdAt: iso(row.created_at),
    });
}

async function loadTags(quizIds: string[], database: QueryExecutor): Promise<Map<string, Tag[]>> {
    const result = new Map<string, Tag[]>();
    if (quizIds.length === 0) return result;
    const tags = await database.query<TagRow>(
        `SELECT qt.quiz_id, t.id, t.created_by, t.name, t.slug, t.created_at
         FROM public.quiz_tags qt JOIN public.tags t ON t.id = qt.tag_id
         WHERE qt.quiz_id = ANY($1::uuid[]) ORDER BY t.name, t.id`,
        [quizIds],
    );
    for (const row of tags.rows) {
        const values = result.get(row.quiz_id) ?? [];
        values.push(mapTag(row));
        result.set(row.quiz_id, values);
    }
    return result;
}

async function loadVersion(versionId: string, database: QueryExecutor): Promise<QuizVersion> {
    const versions = await database.query<QuizVersionRow>(
        `SELECT * FROM public.quiz_versions WHERE id = $1`,
        [versionId],
    );
    const version = versions.rows[0];
    if (!version) throw new Error("Quiz version was not found");
    const memberships = await database.query<MembershipRow>(
        `SELECT m.*, qv.prompt, qv.question_type, qv.answer_config,
                qv.grading_config, qv.explanation
         FROM public.quiz_version_questions m
         JOIN public.question_versions qv ON qv.id = m.question_version_id
         WHERE m.quiz_version_id = $1 ORDER BY m.position`,
        [versionId],
    );
    return quizVersionSchema.parse({
        id: version.id,
        versionNumber: version.version_number,
        title: version.title,
        description: version.description,
        settings: quizSettingsSchema.parse(version.settings),
        questions: memberships.rows.map((row) => ({
            id: row.id,
            questionId: row.question_id,
            questionVersionId: row.question_version_id,
            position: row.position,
            points: Number(row.points),
            required: row.required,
            timeLimitSeconds: row.time_limit_seconds,
            question: questionVersionContentSchema.parse({
                prompt: row.prompt,
                questionType: row.question_type,
                answerConfig: row.answer_config,
                gradingConfig: row.grading_config,
                explanation: row.explanation,
            }),
        })),
        createdBy: version.created_by,
        createdAt: iso(version.created_at),
    });
}

async function mapDetail(
    row: QuizRow,
    viewerId: string | null,
    database: QueryExecutor,
): Promise<QuizDetail> {
    if (!row.current_version_id) throw new Error("Quiz has no current version");
    const tags = (await loadTags([row.id], database)).get(row.id) ?? [];
    return quizDetailSchema.parse({
        id: row.id,
        createdBy: row.created_by,
        visibility: row.visibility,
        status: row.status,
        createdAt: iso(row.created_at),
        updatedAt: iso(row.updated_at),
        tags,
        isOwner: row.created_by === viewerId,
        currentVersion: await loadVersion(row.current_version_id, database),
    });
}

export async function getQuizDetail(
    quizId: string,
    viewerId: string | null,
    database: QueryExecutor = pool,
): Promise<QuizDetail | null> {
    const result = await database.query<QuizRow>(
        `SELECT * FROM public.quizzes
         WHERE id = $1 AND (created_by = $2::uuid OR
           (status = 'published' AND visibility IN ('public', 'unlisted')))`,
        [quizId, viewerId],
    );
    return result.rows[0] ? mapDetail(result.rows[0], viewerId, database) : null;
}

export async function listQuizzes(
    options: {
        viewerId: string | null;
        scope?: "all" | "mine";
        tagSlug?: string;
        limit: number;
        offset: number;
    },
    database: QueryExecutor = pool,
): Promise<{ items: QuizDetail[]; nextOffset: number | null }> {
    const rows = await database.query<QuizRow>(
        `SELECT q.* FROM public.quizzes q
         WHERE (q.created_by = $1::uuid OR
           ($5::text = 'all' AND q.status = 'published' AND q.visibility = 'public'))
           AND ($2::text IS NULL OR EXISTS (
             SELECT 1 FROM public.quiz_tags qt JOIN public.tags t ON t.id = qt.tag_id
             WHERE qt.quiz_id = q.id AND t.slug = $2
           ))
         ORDER BY q.created_at DESC, q.id DESC LIMIT $3 OFFSET $4`,
        [
            options.viewerId,
            options.tagSlug ?? null,
            options.limit + 1,
            options.offset,
            options.scope ?? "all",
        ],
    );
    const items: QuizDetail[] = [];
    for (const row of rows.rows.slice(0, options.limit)) {
        items.push(await mapDetail(row, options.viewerId, database));
    }
    return quizListResponseSchema.parse({
        items,
        nextOffset: rows.rows.length > options.limit ? options.offset + options.limit : null,
    });
}

export async function getQuizVersions(
    quizId: string,
    ownerId: string,
    database: QueryExecutor = pool,
): Promise<QuizVersion[]> {
    const owned = await database.query<{ id: string }>(
        `SELECT id FROM public.quizzes WHERE id = $1 AND created_by = $2`,
        [quizId, ownerId],
    );
    if (!owned.rows[0]) throw new AppError(404, "QUIZ_NOT_FOUND", "Quiz not found");
    const versions = await database.query<{ id: string }>(
        `SELECT id FROM public.quiz_versions WHERE quiz_id = $1 ORDER BY version_number DESC`,
        [quizId],
    );
    const result: QuizVersion[] = [];
    for (const row of versions.rows) result.push(await loadVersion(row.id, database));
    return result;
}

function canonicalContent(content: QuizContent): string {
    const valid = quizContentSchema.parse(content);
    return JSON.stringify({
        title: valid.title,
        description: valid.description,
        settings: quizSettingsSchema.parse(valid.settings),
        questions: valid.questions.map((question) => ({
            questionId: question.questionId,
            questionVersionId: question.questionVersionId,
            points: question.points,
            required: question.required,
            timeLimitSeconds: question.timeLimitSeconds,
        })),
    });
}

function versionContent(version: QuizVersion): QuizContent {
    return {
        title: version.title,
        description: version.description,
        settings: version.settings,
        questions: version.questions.map((question) => ({
            questionId: question.questionId,
            questionVersionId: question.questionVersionId,
            points: question.points,
            required: question.required,
            timeLimitSeconds: question.timeLimitSeconds,
        })),
    };
}

function assertPublishable(content: QuizContent): void {
    if (content.questions.length === 0) {
        throw new AppError(409, "EMPTY_QUIZ", "A published quiz needs at least one question");
    }
}

async function assertQuestionMembership(
    ownerId: string,
    content: QuizContent,
    previous: QuizVersion | null,
    database: QueryExecutor,
): Promise<void> {
    const retained = new Set(
        previous?.questions.map(
            (question) => `${question.questionId}:${question.questionVersionId}`,
        ),
    );
    for (const question of content.questions) {
        if (retained.has(`${question.questionId}:${question.questionVersionId}`)) continue;
        const allowed = await database.query<{ id: string }>(
            `SELECT v.id FROM public.question_versions v
             JOIN public.questions q ON q.id = v.question_id
             WHERE v.id = $1 AND q.id = $2 AND
               ((q.created_by = $3::uuid AND q.status <> 'archived') OR
                (q.status = 'published' AND q.visibility IN ('public', 'unlisted')))`,
            [question.questionVersionId, question.questionId, ownerId],
        );
        if (!allowed.rows[0]) {
            throw new AppError(404, "QUESTION_VERSION_NOT_FOUND", "Question version not available");
        }
    }
}

async function insertVersion(
    quizId: string,
    ownerId: string,
    number: number,
    content: QuizContent,
    database: QueryExecutor,
): Promise<string> {
    const versions = await database.query<{ id: string }>(
        `INSERT INTO public.quiz_versions
           (quiz_id, version_number, title, description, settings, created_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6) RETURNING id`,
        [
            quizId,
            number,
            content.title,
            content.description,
            JSON.stringify(content.settings),
            ownerId,
        ],
    );
    const versionId = versions.rows[0]?.id;
    if (!versionId) throw new Error("Quiz version insertion returned no row");
    for (const [position, question] of content.questions.entries()) {
        await database.query(
            `INSERT INTO public.quiz_version_questions
               (quiz_version_id, question_id, question_version_id, position, points, required, time_limit_seconds)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
                versionId,
                question.questionId,
                question.questionVersionId,
                position,
                question.points,
                question.required,
                question.timeLimitSeconds,
            ],
        );
    }
    await database.query(
        `UPDATE public.quizzes SET current_version_id = $1, updated_at = now() WHERE id = $2`,
        [versionId, quizId],
    );
    return versionId;
}

export async function createQuizInTransaction(
    ownerId: string,
    input: { content: QuizContent; visibility: Visibility; status: "draft" | "published" },
    database: QueryExecutor,
): Promise<QuizDetail> {
    const content = quizContentSchema.parse(input.content);
    if (input.status === "published") assertPublishable(content);
    await assertQuestionMembership(ownerId, content, null, database);
    const rows = await database.query<QuizRow>(
        `INSERT INTO public.quizzes (created_by, visibility, status)
         VALUES ($1, $2, $3) RETURNING *`,
        [ownerId, input.visibility, input.status],
    );
    const quiz = rows.rows[0];
    if (!quiz) throw new Error("Quiz insertion returned no row");
    await insertVersion(quiz.id, ownerId, 1, content, database);
    const detail = await getQuizDetail(quiz.id, ownerId, database);
    if (!detail) throw new Error("Created quiz was not found");
    return detail;
}

export function createQuiz(
    ownerId: string,
    input: { content: QuizContent; visibility: Visibility; status: "draft" | "published" },
): Promise<QuizDetail> {
    return withTransaction((client) => createQuizInTransaction(ownerId, input, client));
}

export async function saveQuizContentInTransaction(
    quizId: string,
    ownerId: string,
    submitted: QuizContent,
    database: QueryExecutor,
): Promise<QuizDetail> {
    const content = quizContentSchema.parse(submitted);
    const rows = await database.query<QuizRow>(
        `SELECT * FROM public.quizzes WHERE id = $1 AND created_by = $2 FOR UPDATE`,
        [quizId, ownerId],
    );
    const quiz = rows.rows[0];
    if (!quiz) throw new AppError(404, "QUIZ_NOT_FOUND", "Quiz not found");
    if (quiz.status === "archived") {
        throw new AppError(409, "QUIZ_ARCHIVED", "Archived quizzes cannot be edited");
    }
    if (!quiz.current_version_id) throw new Error("Quiz has no current version");
    const current = await loadVersion(quiz.current_version_id, database);
    if (canonicalContent(content) === canonicalContent(versionContent(current))) {
        const detail = await getQuizDetail(quizId, ownerId, database);
        if (!detail) throw new Error("Quiz was not found after no-op save");
        return detail;
    }
    if (quiz.status === "published") assertPublishable(content);
    await assertQuestionMembership(ownerId, content, current, database);
    await insertVersion(quizId, ownerId, current.versionNumber + 1, content, database);
    const detail = await getQuizDetail(quizId, ownerId, database);
    if (!detail) throw new Error("Saved quiz was not found");
    return detail;
}

export function saveQuizContent(
    quizId: string,
    ownerId: string,
    content: QuizContent,
): Promise<QuizDetail> {
    return withTransaction((client) =>
        saveQuizContentInTransaction(quizId, ownerId, content, client),
    );
}

export async function updateQuizMetadataInTransaction(
    quizId: string,
    ownerId: string,
    metadata: { visibility?: Visibility; status?: ContentStatus },
    database: QueryExecutor,
): Promise<QuizDetail> {
    const rows = await database.query<QuizRow>(
        `SELECT * FROM public.quizzes WHERE id = $1 AND created_by = $2 FOR UPDATE`,
        [quizId, ownerId],
    );
    const quiz = rows.rows[0];
    if (!quiz) throw new AppError(404, "QUIZ_NOT_FOUND", "Quiz not found");
    if (metadata.status === "published") {
        if (!quiz.current_version_id) throw new Error("Quiz has no current version");
        assertPublishable(versionContent(await loadVersion(quiz.current_version_id, database)));
    }
    await database.query(
        `UPDATE public.quizzes
         SET visibility = COALESCE($3::public.content_visibility, visibility),
             status = COALESCE($4::public.content_status, status), updated_at = now()
         WHERE id = $1 AND created_by = $2`,
        [quizId, ownerId, metadata.visibility ?? null, metadata.status ?? null],
    );
    const detail = await getQuizDetail(quizId, ownerId, database);
    if (!detail) throw new Error("Updated quiz was not found");
    return detail;
}

export function updateQuizMetadata(
    quizId: string,
    ownerId: string,
    metadata: { visibility?: Visibility; status?: ContentStatus },
): Promise<QuizDetail> {
    return withTransaction((client) =>
        updateQuizMetadataInTransaction(quizId, ownerId, metadata, client),
    );
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
