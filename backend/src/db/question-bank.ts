import {
    bankQuestionDetailSchema,
    bankQuestionListResponseSchema,
    questionDetailSchema,
    questionListResponseSchema,
    questionVersionSchema,
    questionVersionContentSchema,
    tagListResponseSchema,
    tagSchema,
    type BankQuestionDetail,
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
import { supersedeQuestionWorkItems } from "./content-workflow.ts";

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
    agent_run_id: string | null;
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
        ...(row.agent_run_id ? { agentRunId: row.agent_run_id } : {}),
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
    ownerId: string,
    database: QueryExecutor = pool,
): Promise<QuestionDetail | null> {
    const questions = await database.query<QuestionRow>(
        `SELECT * FROM public.questions q
         WHERE q.id = $1 AND q.created_by = $2::uuid`,
        [questionId, ownerId],
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
        isOwner: true,
        currentVersion: mapVersion(version),
        ...(question.agent_origin_run_id ? { agentOriginRunId: question.agent_origin_run_id } : {}),
    });
}

export async function getBankQuestionDetail(
    questionId: string,
    viewerId: string | null,
    database: QueryExecutor = pool,
): Promise<BankQuestionDetail | null> {
    const result = await database.query<QuestionRow>(
        `SELECT * FROM public.questions q
         WHERE q.id = $1 AND q.status = 'published'
           AND (q.created_by = $2::uuid OR q.visibility IN ('public', 'unlisted'))`,
        [questionId, viewerId],
    );
    const question = result.rows[0];
    if (!question?.default_published_version_id) return null;
    const versions = await database.query<VersionRow>(
        `SELECT * FROM public.question_versions WHERE question_id = $1 AND id = $2`,
        [question.id, question.default_published_version_id],
    );
    const version = versions.rows[0];
    if (!version) throw new Error("Default published question version was not found");
    const tags = (await loadTags([question.id], database)).get(question.id) ?? [];
    return bankQuestionDetailSchema.parse({
        id: question.id,
        createdBy: question.created_by,
        visibility: question.visibility,
        status: question.status,
        createdAt: iso(question.created_at),
        updatedAt: iso(question.updated_at),
        isOwner: question.created_by === viewerId,
        tags,
        publishedVersion: mapVersion(version),
    });
}

export async function listQuestions(
    options: { viewerId: string | null; tagSlug?: string; limit: number; offset: number },
    database: QueryExecutor = pool,
): Promise<{ items: BankQuestionDetail[]; nextOffset: number | null }> {
    const rows = await database.query<ListRow>(
        `SELECT q.*, v.id AS version_id, v.version_number, v.prompt, v.question_type,
                v.answer_config, v.grading_config, v.explanation,
                v.created_by AS version_created_by, v.created_at AS version_created_at,
                v.agent_run_id
         FROM public.questions q
         JOIN public.question_versions v ON v.id = q.default_published_version_id
         WHERE q.status = 'published'
           AND (q.created_by = $1::uuid OR q.visibility = 'public')
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
        bankQuestionDetailSchema.parse({
            id: row.id,
            createdBy: row.created_by,
            visibility: row.visibility,
            status: row.status,
            createdAt: iso(row.created_at),
            updatedAt: iso(row.updated_at),
            isOwner: row.created_by === options.viewerId,
            tags: tags.get(row.id) ?? [],
            publishedVersion: mapVersion({
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
                agent_run_id: row.agent_run_id,
            }),
        }),
    );

    return bankQuestionListResponseSchema.parse({
        items,
        nextOffset: rows.rows.length > options.limit ? options.offset + options.limit : null,
    });
}

export async function listManagedQuestions(
    options: { ownerId: string; tagSlug?: string; limit: number; offset: number },
    database: QueryExecutor = pool,
): Promise<{ items: QuestionDetail[]; nextOffset: number | null }> {
    const rows = await database.query<ListRow>(
        `SELECT q.*, v.id AS version_id, v.version_number, v.prompt, v.question_type,
                v.answer_config, v.grading_config, v.explanation,
                v.created_by AS version_created_by, v.created_at AS version_created_at,
                v.agent_run_id
         FROM public.questions q
         JOIN public.question_versions v ON v.id = q.current_version_id
         WHERE q.created_by = $1::uuid
           AND ($2::text IS NULL OR EXISTS (
             SELECT 1 FROM public.question_tags qt
             JOIN public.tags t ON t.id = qt.tag_id
             WHERE qt.question_id = q.id AND t.slug = $2
           ))
         ORDER BY q.created_at DESC, q.id DESC LIMIT $3 OFFSET $4`,
        [options.ownerId, options.tagSlug ?? null, options.limit + 1, options.offset],
    );
    const selected = rows.rows.slice(0, options.limit);
    const tags = await loadTags(
        selected.map((row) => row.id),
        database,
    );
    return questionListResponseSchema.parse({
        items: selected.map((row) =>
            questionDetailSchema.parse({
                id: row.id,
                createdBy: row.created_by,
                visibility: row.visibility,
                status: row.status,
                createdAt: iso(row.created_at),
                updatedAt: iso(row.updated_at),
                isOwner: true,
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
                    agent_run_id: row.agent_run_id,
                }),
            }),
        ),
        nextOffset: rows.rows.length > options.limit ? options.offset + options.limit : null,
    });
}

export async function getPublishedQuestionVersions(
    questionId: string,
    viewerId: string | null,
    database: QueryExecutor = pool,
): Promise<QuestionVersion[]> {
    const question = await getBankQuestionDetail(questionId, viewerId, database);
    if (!question) throw new AppError(404, "QUESTION_NOT_FOUND", "Question not found");
    const versions = await database.query<VersionRow>(
        `SELECT v.* FROM public.question_versions v
         WHERE v.question_id = $1 AND EXISTS (
           SELECT 1 FROM public.question_publication_events e
           WHERE e.question_id = v.question_id AND e.question_version_id = v.id
             AND e.event_type IN ('legacy_published', 'published')
         ) ORDER BY v.version_number DESC`,
        [questionId],
    );
    return versions.rows.map(mapVersion);
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
    },
    database: QueryExecutor,
    agentRunId: string | null = null,
): Promise<QuestionDetail> {
    const content = questionVersionContentSchema.parse(input.content);
    const questions = await database.query<QuestionRow>(
        `INSERT INTO public.questions (created_by, visibility, agent_origin_run_id)
         VALUES ($1, $2, $3) RETURNING *`,
        [ownerId, input.visibility, agentRunId],
    );
    const question = questions.rows[0];
    if (!question) throw new Error("Question insertion returned no row");

    const versions = await database.query<VersionRow>(
        `INSERT INTO public.question_versions
           (question_id, version_number, prompt, question_type, answer_config,
            grading_config, explanation, created_by, agent_run_id)
         VALUES ($1, 1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8)
         RETURNING *`,
        [
            question.id,
            content.prompt,
            content.questionType,
            JSON.stringify(content.answerConfig),
            JSON.stringify(content.gradingConfig),
            content.explanation,
            ownerId,
            agentRunId,
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
    },
): Promise<QuestionDetail> {
    return withTransaction((client) => createQuestionInTransaction(ownerId, input, client));
}

export async function createQuestionVersionInTransaction(
    questionId: string,
    ownerId: string,
    content: QuestionVersionContent,
    database: QueryExecutor,
    agentRunId?: string,
    revisionWorkItemId?: string,
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
            grading_config, explanation, created_by, agent_run_id)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8, $9)
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
            agentRunId ?? null,
        ],
    );
    const version = versions.rows[0];
    if (!version) throw new Error("Question version insertion returned no row");

    await database.query(
        `UPDATE public.questions SET current_version_id = $1, updated_at = now()
         WHERE id = $2`,
        [version.id, questionId],
    );
    await supersedeQuestionWorkItems(questionId, version.id, ownerId, database, revisionWorkItemId);
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
    metadata: { visibility: Visibility },
    database: QueryExecutor,
): Promise<QuestionDetail> {
    const updated = await database.query<QuestionRow>(
        `UPDATE public.questions
         SET visibility = $3::public.content_visibility, updated_at = now()
         WHERE id = $1 AND created_by = $2
         RETURNING *`,
        [questionId, ownerId, metadata.visibility],
    );
    if (!updated.rows[0]) throw new AppError(404, "QUESTION_NOT_FOUND", "Question not found");
    const detail = await getQuestionDetail(questionId, ownerId, database);
    if (!detail) throw new Error("Updated question was not found");
    return detail;
}

export function updateQuestionMetadata(
    questionId: string,
    ownerId: string,
    metadata: { visibility: Visibility },
): Promise<QuestionDetail> {
    return withTransaction((client) =>
        updateQuestionMetadataInTransaction(questionId, ownerId, metadata, client),
    );
}

async function lockOwnedQuestion(
    questionId: string,
    ownerId: string,
    database: QueryExecutor,
): Promise<QuestionRow> {
    const result = await database.query<QuestionRow>(
        `SELECT * FROM public.questions WHERE id = $1 AND created_by = $2 FOR UPDATE`,
        [questionId, ownerId],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, "QUESTION_NOT_FOUND", "Question not found");
    return row;
}

async function recordPublicationEvent(
    questionId: string,
    versionId: string | null,
    actorId: string,
    eventType: string,
    database: QueryExecutor,
    policySnapshot: Record<string, unknown> | null = null,
): Promise<void> {
    await database.query(
        `INSERT INTO public.question_publication_events
           (question_id, question_version_id, actor_id, event_type, policy_snapshot)
         VALUES ($1, $2, $3, $4, $5::jsonb)`,
        [
            questionId,
            versionId,
            actorId,
            eventType,
            policySnapshot ? JSON.stringify(policySnapshot) : null,
        ],
    );
}

export async function publishQuestionInTransaction(
    questionId: string,
    ownerId: string,
    versionId: string,
    database: QueryExecutor,
): Promise<QuestionDetail> {
    const question = await lockOwnedQuestion(questionId, ownerId, database);
    if (question.status === "archived") {
        throw new AppError(409, "QUESTION_ARCHIVED", "Restore the question before publishing");
    }
    if (question.current_version_id !== versionId) {
        throw new AppError(409, "STALE_QUESTION_VERSION", "Publish the current candidate version");
    }
    if (question.agent_origin_run_id)
        throw new AppError(403, "AGENT_REVIEW_REQUIRED", "Agent-origin questions require review");
    const submitted = await database.query<{ id: string }>(
        `SELECT id FROM public.question_review_submissions WHERE question_version_id = $1`,
        [versionId],
    );
    if (submitted.rows[0]) {
        throw new AppError(
            409,
            "REVIEW_REQUIRED",
            "This version must complete its review workflow",
        );
    }
    if (question.status === "published" && question.default_published_version_id === versionId) {
        const detail = await getQuestionDetail(questionId, ownerId, database);
        if (!detail) throw new Error("Published question was not found");
        return detail;
    }
    const version = await database.query<{ created_by: string; agent_run_id: string | null }>(
        `SELECT created_by, agent_run_id FROM public.question_versions WHERE question_id = $1 AND id = $2`,
        [questionId, versionId],
    );
    if (version.rows[0]?.created_by !== ownerId || version.rows[0]?.agent_run_id) {
        throw new AppError(
            403,
            "PUBLISH_NOT_ALLOWED",
            "Only a human-authored candidate can publish directly",
        );
    }
    await recordPublicationEvent(questionId, versionId, ownerId, "direct_approved", database, {
        version: 1,
        mode: "direct_human",
        actorId: ownerId,
        humanAuthRequired: true,
        reviewSubmissionAllowed: false,
    });
    await recordPublicationEvent(questionId, versionId, ownerId, "published", database);
    await database.query(
        `UPDATE public.questions
         SET status = 'published', default_published_version_id = $2, updated_at = now()
         WHERE id = $1`,
        [questionId, versionId],
    );
    const detail = await getQuestionDetail(questionId, ownerId, database);
    if (!detail) throw new Error("Published question was not found");
    return detail;
}

export function publishQuestion(questionId: string, ownerId: string, versionId: string) {
    return withTransaction((client) =>
        publishQuestionInTransaction(questionId, ownerId, versionId, client),
    );
}

export async function unpublishQuestionInTransaction(
    questionId: string,
    ownerId: string,
    database: QueryExecutor,
): Promise<QuestionDetail> {
    const question = await lockOwnedQuestion(questionId, ownerId, database);
    if (question.status === "archived") {
        throw new AppError(409, "QUESTION_ARCHIVED", "Restore the question before unpublishing");
    }
    if (question.status === "published") {
        await recordPublicationEvent(
            questionId,
            question.default_published_version_id,
            ownerId,
            "unpublished",
            database,
        );
        await database.query(
            `UPDATE public.questions
             SET status = 'draft', default_published_version_id = NULL, updated_at = now()
             WHERE id = $1`,
            [questionId],
        );
    }
    const detail = await getQuestionDetail(questionId, ownerId, database);
    if (!detail) throw new Error("Unpublished question was not found");
    return detail;
}

export function unpublishQuestion(questionId: string, ownerId: string) {
    return withTransaction((client) => unpublishQuestionInTransaction(questionId, ownerId, client));
}

export async function archiveQuestionInTransaction(
    questionId: string,
    ownerId: string,
    database: QueryExecutor,
): Promise<QuestionDetail> {
    const question = await lockOwnedQuestion(questionId, ownerId, database);
    if (question.status !== "archived") {
        await recordPublicationEvent(
            questionId,
            question.default_published_version_id,
            ownerId,
            "archived",
            database,
        );
        await database.query(
            `UPDATE public.questions SET status = 'archived', updated_at = now() WHERE id = $1`,
            [questionId],
        );
    }
    const detail = await getQuestionDetail(questionId, ownerId, database);
    if (!detail) throw new Error("Archived question was not found");
    return detail;
}

export function archiveQuestion(questionId: string, ownerId: string) {
    return withTransaction((client) => archiveQuestionInTransaction(questionId, ownerId, client));
}

export async function restoreQuestionInTransaction(
    questionId: string,
    ownerId: string,
    database: QueryExecutor,
): Promise<QuestionDetail> {
    const question = await lockOwnedQuestion(questionId, ownerId, database);
    if (question.status !== "archived") {
        throw new AppError(409, "QUESTION_NOT_ARCHIVED", "Question is not archived");
    }
    const versionId = question.default_published_version_id;
    if (versionId) {
        const published = await database.query<{ id: string }>(
            `SELECT id FROM public.question_publication_events
             WHERE question_id = $1 AND question_version_id = $2
               AND event_type IN ('legacy_published', 'published') LIMIT 1`,
            [questionId, versionId],
        );
        if (!published.rows[0]) {
            throw new AppError(
                409,
                "PUBLICATION_HISTORY_MISSING",
                "Published version has no publication record",
            );
        }
    }
    await recordPublicationEvent(questionId, versionId, ownerId, "restored", database);
    await database.query(
        `UPDATE public.questions SET status = $2::public.content_status, updated_at = now()
         WHERE id = $1`,
        [questionId, versionId ? "published" : "draft"],
    );
    const detail = await getQuestionDetail(questionId, ownerId, database);
    if (!detail) throw new Error("Restored question was not found");
    return detail;
}

export function restoreQuestion(questionId: string, ownerId: string) {
    return withTransaction((client) => restoreQuestionInTransaction(questionId, ownerId, client));
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
