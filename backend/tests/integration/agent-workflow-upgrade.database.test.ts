import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

const owner = "00000000-0000-4000-8000-000000000901";
const generator = "00000000-0000-4000-8000-00000000a001";
const directory = resolve(import.meta.dirname, "../../../supabase/migrations");

it("upgrades existing human decisions and creation claims without losing their actors", async () => {
    const database = new PGlite();
    try {
        await database.exec("CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY)");
        const migrations = readdirSync(directory)
            .filter((name) => name.endsWith(".sql"))
            .sort();
        const phaseFour = "20260930220000_agent_review_gate.sql";
        for (const name of migrations.filter((name) => name < phaseFour))
            await database.exec(readFileSync(resolve(directory, name), "utf8"));

        await database.query("INSERT INTO auth.users (id) VALUES ($1)", [owner]);
        await database.query(
            "INSERT INTO public.profiles (id, display_name) VALUES ($1, 'Owner')",
            [owner],
        );
        const question = await database.query<{ id: string }>(
            "INSERT INTO public.questions (created_by) VALUES ($1) RETURNING id",
            [owner],
        );
        const version = await database.query<{ id: string }>(
            `INSERT INTO public.question_versions
             (question_id, version_number, prompt, question_type, answer_config,
              grading_config, created_by)
             VALUES ($1, 1, 'Existing candidate', 'exact_text', '{}'::jsonb, '{}'::jsonb, $2)
             RETURNING id`,
            [question.rows[0].id, owner],
        );
        await database.query("UPDATE public.questions SET current_version_id = $2 WHERE id = $1", [
            question.rows[0].id,
            version.rows[0].id,
        ]);
        const submission = await database.query<{ id: string }>(
            `INSERT INTO public.question_review_submissions
             (question_id, question_version_id, submitted_by, policy_snapshot)
             VALUES ($1, $2, $3, $4::jsonb)
             RETURNING id`,
            [
                question.rows[0].id,
                version.rows[0].id,
                owner,
                JSON.stringify({
                    version: 1,
                    mode: "human_review",
                    source: "human",
                    reviewerId: owner,
                    gateActorId: owner,
                    selfReviewAllowed: true,
                    directPublish: false,
                }),
            ],
        );
        const review = await database.query<{ id: string }>(
            `INSERT INTO public.work_items
             (queue_name, item_type, question_id, question_version_id, submission_id,
              assigned_to, input, status, operation_key)
             VALUES ('question-review', 'REVIEW_QUESTION', $1, $2, $3, $4,
              $5::jsonb,
              'completed', 'upgrade-review') RETURNING id`,
            [
                question.rows[0].id,
                version.rows[0].id,
                submission.rows[0].id,
                owner,
                JSON.stringify({
                    schemaVersion: 1,
                    type: "REVIEW_QUESTION",
                    versionId: version.rows[0].id,
                }),
            ],
        );
        const decision = await database.query<{ id: string }>(
            `INSERT INTO public.question_review_decisions
             (submission_id, work_item_id, actor_id, decision)
             VALUES ($1, $2, $3, 'approved') RETURNING id`,
            [submission.rows[0].id, review.rows[0].id, owner],
        );
        const gate = await database.query<{ id: string }>(
            `INSERT INTO public.work_items
             (queue_name, item_type, question_id, question_version_id, submission_id,
              assigned_to, input, status, operation_key)
             VALUES ('question-ready-to-publish', 'APPROVE_PUBLICATION', $1, $2, $3, $4,
              $5::jsonb,
              'completed', 'upgrade-gate') RETURNING id`,
            [
                question.rows[0].id,
                version.rows[0].id,
                submission.rows[0].id,
                owner,
                JSON.stringify({
                    schemaVersion: 1,
                    type: "APPROVE_PUBLICATION",
                    versionId: version.rows[0].id,
                    reviewDecisionId: decision.rows[0].id,
                }),
            ],
        );
        await database.query(
            `INSERT INTO public.question_publication_gate_decisions
             (submission_id, review_decision_id, work_item_id, actor_id, decision, findings,
              policy_snapshot)
             VALUES ($1, $2, $3, $4, 'rejected', 'Needs another candidate', '{}'::jsonb)`,
            [submission.rows[0].id, decision.rows[0].id, gate.rows[0].id, owner],
        );
        const creation = await database.query<{ id: string; claim_token: string }>(
            `INSERT INTO public.work_items
             (queue_name, item_type, assigned_to, input, status, claim_token,
              claimed_agent_actor_id, lease_until, attempts, operation_key)
             VALUES ('question-creation', 'CREATE_QUESTION', $1,
              '{"schemaVersion":1,"type":"CREATE_QUESTION","brief":"Existing job"}'::jsonb,
              'claimed', gen_random_uuid(), $2, now() + interval '5 minutes', 1,
              'upgrade-create') RETURNING id, claim_token`,
            [owner, generator],
        );

        await database.exec(readFileSync(resolve(directory, phaseFour), "utf8"));

        const upgraded = await database.query<{
            assigned_agent_actor_id: string;
            claimed_agent_actor_id: string;
            claim_token: string;
            status: string;
        }>(
            "SELECT assigned_agent_actor_id, claimed_agent_actor_id, claim_token, status FROM public.work_items WHERE id = $1",
            [creation.rows[0].id],
        );
        expect(upgraded.rows[0]).toEqual({
            assigned_agent_actor_id: generator,
            claimed_agent_actor_id: generator,
            claim_token: creation.rows[0].claim_token,
            status: "claimed",
        });
        const oldDecisions = await database.query<{
            review_actor: string;
            review_agent: string | null;
            gate_actor: string;
            gate_agent: string | null;
        }>(
            `SELECT r.actor_id AS review_actor, r.agent_actor_id AS review_agent,
            g.actor_id AS gate_actor, g.agent_actor_id AS gate_agent
            FROM public.question_review_decisions r
            JOIN public.question_publication_gate_decisions g ON g.review_decision_id = r.id
            WHERE r.id = $1`,
            [decision.rows[0].id],
        );
        expect(oldDecisions.rows[0]).toEqual({
            review_actor: owner,
            review_agent: null,
            gate_actor: owner,
            gate_agent: null,
        });
    } finally {
        await database.close();
    }
});
