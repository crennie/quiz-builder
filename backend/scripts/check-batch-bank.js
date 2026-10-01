import assert from "node:assert/strict";
import { argv, stdout } from "node:process";

import {
    bankQuestionDetailSchema,
    bankQuestionListResponseSchema,
    questionVersionsResponseSchema,
} from "@quiz-builder/contracts";
import request from "supertest";
import { z } from "zod";

import { app } from "../src/app.ts";
import { closeDatabase, pool } from "../src/db/index.ts";

async function listBankQuestions(tag) {
    const items = [];
    let offset = 0;
    while (true) {
        const response = await request(app)
            .get("/api/v1/questions")
            .query({ limit: 100, offset, ...(tag ? { tag } : {}) });
        assert.equal(response.status, 200, "Bank list endpoint failed");
        const page = bankQuestionListResponseSchema.parse(response.body);
        items.push(...page.items);
        if (page.nextOffset === null) return items;
        assert.ok(page.nextOffset > offset, "Bank pagination did not advance");
        offset = page.nextOffset;
    }
}

async function checkBatchBank() {
    const requestedId = argv[2] ? z.uuid().parse(argv[2]) : null;
    const batch = await pool.query(
        requestedId
            ? `SELECT id, jsonb_array_length(artifact->'questions') AS question_count
               FROM public.question_batches WHERE id = $1`
            : `SELECT id, jsonb_array_length(artifact->'questions') AS question_count
               FROM public.question_batches ORDER BY created_at DESC, id DESC LIMIT 1`,
        requestedId ? [requestedId] : [],
    );
    assert.ok(batch.rows[0], "No matching batch was found");

    const mappings = await pool.query(
        `SELECT i.question_id, q.status, q.visibility,
                q.default_published_version_id
         FROM public.question_batch_items i
         JOIN public.questions q ON q.id = i.question_id
         WHERE i.batch_id = $1 ORDER BY i.position`,
        [batch.rows[0].id],
    );
    assert.equal(
        mappings.rows.length,
        batch.rows[0].question_count,
        "The retained batch is not fully materialized",
    );

    const bankItems = await listBankQuestions();
    const bankById = new Map(bankItems.map((item) => [item.id, item]));
    let publicCount = 0;
    let hiddenCount = 0;

    for (const mapping of mappings.rows) {
        const detailResponse = await request(app).get(`/api/v1/questions/${mapping.question_id}`);
        const listed = bankById.get(mapping.question_id);
        if (mapping.status === "published" && mapping.visibility === "public") {
            publicCount += 1;
            assert.equal(detailResponse.status, 200, "Published public detail was unavailable");
            const detail = bankQuestionDetailSchema.parse(detailResponse.body);
            assert.equal(detail.publishedVersion.id, mapping.default_published_version_id);
            assert.equal(listed?.publishedVersion.id, mapping.default_published_version_id);

            const versionsResponse = await request(app).get(
                `/api/v1/questions/${mapping.question_id}/published-versions`,
            );
            assert.equal(versionsResponse.status, 200, "Published versions endpoint failed");
            const versions = questionVersionsResponseSchema.parse(versionsResponse.body);
            assert.ok(
                versions.versions.some(
                    (version) => version.id === mapping.default_published_version_id,
                ),
                "The published version is missing from version history",
            );

            for (const tag of detail.tags) {
                const taggedItems = await listBankQuestions(tag.slug);
                assert.ok(
                    taggedItems.some((item) => item.id === mapping.question_id),
                    `Published question is missing from the ${tag.slug} tag filter`,
                );
            }
        } else if (mapping.status === "published" && mapping.visibility === "unlisted") {
            assert.equal(detailResponse.status, 200, "Published unlisted detail was unavailable");
            const detail = bankQuestionDetailSchema.parse(detailResponse.body);
            assert.equal(detail.publishedVersion.id, mapping.default_published_version_id);
            assert.equal(listed, undefined, "Unlisted question appeared in public discovery");
        } else {
            hiddenCount += 1;
            assert.equal(detailResponse.status, 404, "Unpublished or private detail was exposed");
            assert.equal(
                listed,
                undefined,
                "Unpublished or private question appeared in bank list",
            );
        }
    }

    assert.ok(publicCount > 0, "Batch has no published public question to verify in discovery");
    stdout.write(
        `Batch bank check passed: ${mappings.rows.length} mapped, ${publicCount} public published, ${hiddenCount} hidden.\n`,
    );
}

try {
    await checkBatchBank();
} finally {
    await closeDatabase();
}
