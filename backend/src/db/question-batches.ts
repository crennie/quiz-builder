import { createHash } from "node:crypto";
import {
    questionBatchArtifactSchema,
    questionBatchListSchema,
    questionBatchSchema,
    type QuestionBatch,
    type QuestionBatchArtifact,
} from "@quiz-builder/contracts";
import { AppError } from "../errors/app-error.ts";
import { pool } from "./index.ts";
import { withTransaction } from "./transaction.ts";
import { createQuestionInTransaction, slugify, type QueryExecutor } from "./question-bank.ts";

type BatchRow = {
    id: string;
    sponsor_id: string;
    artifact: unknown;
    artifact_sha256: string;
    created_at: string | Date;
};
type ItemRow = {
    item_key: string;
    question_id: string;
    question_version_id: string;
    current_version_id: string;
};

function canonicalJson(value: unknown): string {
    if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
    if (value !== null && typeof value === "object")
        return `{${Object.entries(value)
            .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
            .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
            .join(",")}}`;
    return JSON.stringify(value) ?? "null";
}

async function loadBatch(
    batchId: string,
    sponsorId: string,
    database: QueryExecutor,
    lock = false,
): Promise<QuestionBatch> {
    const result = await database.query<BatchRow>(
        `SELECT * FROM public.question_batches WHERE id = $1 AND sponsor_id = $2 ${lock ? "FOR UPDATE" : ""}`,
        [batchId, sponsorId],
    );
    const row = result.rows[0];
    if (!row) throw new AppError(404, "QUESTION_BATCH_NOT_FOUND", "Question batch not found");
    const items = await database.query<ItemRow>(
        `SELECT i.item_key, i.question_id, i.question_version_id, q.current_version_id
         FROM public.question_batch_items i
         JOIN public.questions q ON q.id = i.question_id
         WHERE i.batch_id = $1 ORDER BY i.position`,
        [batchId],
    );
    return questionBatchSchema.parse({
        id: row.id,
        artifact: questionBatchArtifactSchema.parse(row.artifact),
        artifactSha256: row.artifact_sha256,
        createdAt: new Date(row.created_at).toISOString(),
        items: items.rows.map((item) => ({
            key: item.item_key,
            questionId: item.question_id,
            versionId: item.question_version_id,
            currentVersionId: item.current_version_id,
        })),
    });
}

export function getQuestionBatch(batchId: string, sponsorId: string) {
    return loadBatch(batchId, sponsorId, pool);
}

export async function listQuestionBatches(sponsorId: string, database: QueryExecutor = pool) {
    const rows = await database.query<{
        id: string;
        topic: string;
        artifact_sha256: string;
        created_at: string | Date;
        question_count: number;
        materialized_count: number;
    }>(
        `SELECT b.id, b.artifact->>'topic' AS topic, b.artifact_sha256, b.created_at,
                jsonb_array_length(b.artifact->'questions') AS question_count,
                count(i.question_id)::int AS materialized_count
         FROM public.question_batches b
         LEFT JOIN public.question_batch_items i ON i.batch_id = b.id
         WHERE b.sponsor_id = $1
         GROUP BY b.id ORDER BY b.created_at DESC, b.id DESC LIMIT 50`,
        [sponsorId],
    );
    return questionBatchListSchema.parse({
        batches: rows.rows.map((row) => ({
            id: row.id,
            topic: row.topic,
            artifactSha256: row.artifact_sha256,
            createdAt: new Date(row.created_at).toISOString(),
            questionCount: row.question_count,
            materializedCount: row.materialized_count,
        })),
    });
}

export async function ingestQuestionBatchInTransaction(
    sponsorId: string,
    document: QuestionBatchArtifact,
    database: QueryExecutor,
): Promise<QuestionBatch> {
    const artifact = questionBatchArtifactSchema.parse(document);
    const serialized = JSON.stringify(artifact);
    const hash = createHash("sha256").update(canonicalJson(artifact)).digest("hex");
    const existing = await database.query<BatchRow>(
        `SELECT * FROM public.question_batches WHERE sponsor_id = $1 AND batch_key = $2`,
        [sponsorId, artifact.batchKey],
    );
    if (existing.rows[0]) {
        if (existing.rows[0].artifact_sha256 !== hash)
            throw new AppError(
                409,
                "QUESTION_BATCH_CONFLICT",
                "Batch key was used for different content",
            );
        return loadBatch(existing.rows[0].id, sponsorId, database);
    }
    const inserted = await database.query<BatchRow>(
        `INSERT INTO public.question_batches
         (sponsor_id, batch_key, artifact, artifact_sha256)
         VALUES ($1, $2, $3::jsonb, $4)
         ON CONFLICT (sponsor_id, batch_key) DO NOTHING RETURNING *`,
        [sponsorId, artifact.batchKey, serialized, hash],
    );
    if (!inserted.rows[0]) {
        const concurrent = await database.query<BatchRow>(
            `SELECT * FROM public.question_batches WHERE sponsor_id = $1 AND batch_key = $2`,
            [sponsorId, artifact.batchKey],
        );
        if (concurrent.rows[0]?.artifact_sha256 !== hash)
            throw new AppError(
                409,
                "QUESTION_BATCH_CONFLICT",
                "Batch key was used for different content",
            );
        return loadBatch(concurrent.rows[0].id, sponsorId, database);
    }
    return loadBatch(inserted.rows[0].id, sponsorId, database);
}

export function ingestQuestionBatch(sponsorId: string, document: QuestionBatchArtifact) {
    return withTransaction((database) =>
        ingestQuestionBatchInTransaction(sponsorId, document, database),
    );
}

async function resolveTags(
    sponsorId: string,
    names: string[],
    database: QueryExecutor,
): Promise<string[]> {
    const ids = new Set<string>();
    for (const name of names) {
        const slug = slugify(name);
        if (!slug)
            throw new AppError(400, "VALIDATION_ERROR", "Tag name must contain a letter or number");
        const inserted = await database.query<{ id: string }>(
            `INSERT INTO public.tags (created_by, name, slug) VALUES ($1, $2, $3)
             ON CONFLICT (created_by, slug) DO NOTHING RETURNING id`,
            [sponsorId, name, slug],
        );
        const found =
            inserted.rows[0] ??
            (
                await database.query<{ id: string }>(
                    `SELECT id FROM public.tags WHERE created_by = $1 AND slug = $2`,
                    [sponsorId, slug],
                )
            ).rows[0];
        if (!found) throw new Error("Tag resolution failed");
        ids.add(found.id);
    }
    return [...ids];
}

export async function materializeQuestionBatchInTransaction(
    batchId: string,
    sponsorId: string,
    database: QueryExecutor,
): Promise<QuestionBatch> {
    const batch = await loadBatch(batchId, sponsorId, database, true);
    if (batch.items.length === batch.artifact.questions.length) return batch;
    if (batch.items.length) throw new Error("Question batch was only partly materialized");
    const tagIds = await resolveTags(sponsorId, batch.artifact.tags, database);
    for (const [position, entry] of batch.artifact.questions.entries()) {
        const question = await createQuestionInTransaction(
            sponsorId,
            { content: entry.content, visibility: "private" },
            database,
        );
        await database.query(
            `INSERT INTO public.question_batch_items
             (batch_id, item_key, position, question_id, question_version_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [batchId, entry.key, position, question.id, question.currentVersion.id],
        );
        for (const tagId of tagIds)
            await database.query(
                `INSERT INTO public.question_tags (question_id, tag_id) VALUES ($1, $2)`,
                [question.id, tagId],
            );
    }
    return loadBatch(batchId, sponsorId, database);
}

export function materializeQuestionBatch(batchId: string, sponsorId: string) {
    return withTransaction((database) =>
        materializeQuestionBatchInTransaction(batchId, sponsorId, database),
    );
}
