import { argv } from "node:process";
import { log } from "node:console";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { z } from "zod";
import { questionBatchArtifactSchema } from "@quiz-builder/contracts";
import { pool, closeDatabase } from "../src/db/index.ts";
import { getQuestionDetail } from "../src/db/question-bank.ts";
function canonical(value) {
    if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
    if (value !== null && typeof value === "object")
        return `{${Object.entries(value)
            .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
            .map(([key, v]) => `${JSON.stringify(key)}:${canonical(v)}`)
            .join(",")}}`;
    return JSON.stringify(value);
}
try {
    const id = z.uuid().parse(argv[2]);
    const result = await pool.query("SELECT * FROM public.question_batches WHERE id=$1", [id]);
    assert.ok(result.rows[0], "Batch not found");
    const row = result.rows[0];
    const artifact = questionBatchArtifactSchema.parse(row.artifact);
    assert.equal(
        row.artifact_sha256,
        createHash("sha256").update(canonical(artifact)).digest("hex"),
    );
    const mappings = await pool.query(
        "SELECT item_key,question_id,position FROM public.question_batch_items WHERE batch_id=$1 ORDER BY position",
        [id],
    );
    assert.equal(
        mappings.rows.length,
        artifact.questions.length,
        "Batch must be fully materialized",
    );
    for (const [position, item] of mappings.rows.entries()) {
        assert.equal(item.position, position);
        assert.equal(item.item_key, artifact.questions[position].key);
        const q = await getQuestionDetail(item.question_id, row.sponsor_id);
        assert.ok(q);
        assert.equal(q.createdBy, row.sponsor_id);
        assert.equal(q.visibility, "private");
        assert.equal(await getQuestionDetail(item.question_id, null), null);
    }
    log(`Private import integrity passed for ${mappings.rows.length} mapped questions.`);
} finally {
    await closeDatabase();
}
