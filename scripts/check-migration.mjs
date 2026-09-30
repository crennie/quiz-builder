import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import { PGlite } from "@electric-sql/pglite";

const database = new PGlite();
const migrationDirectory = resolve("supabase/migrations");
const migrationNames = readdirSync(migrationDirectory)
    .filter((name) => name.endsWith(".sql"))
    .sort();

const userId = "00000000-0000-4000-8000-000000000001";
const questionId = "00000000-0000-4000-8000-000000000002";
const questionVersionId = "00000000-0000-4000-8000-000000000003";
const otherQuestionId = "00000000-0000-4000-8000-000000000004";
const quizId = "00000000-0000-4000-8000-000000000005";
const quizVersionId = "00000000-0000-4000-8000-000000000006";
const membershipId = "00000000-0000-4000-8000-000000000007";
const attemptId = "00000000-0000-4000-8000-000000000008";
const attemptQuestionId = "00000000-0000-4000-8000-000000000009";

try {
    // Supabase owns auth.users; this stub tests our migration against its ID boundary.
    await database.exec("CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY)");
    for (const name of migrationNames) {
        await database.exec(readFileSync(resolve(migrationDirectory, name), "utf8"));
    }

    const tables = await database.query(`
        SELECT count(*)::int AS count FROM pg_tables
        WHERE schemaname = 'public' AND tablename IN (
            'profiles', 'questions', 'question_versions', 'quizzes', 'quiz_versions',
            'quiz_version_questions', 'tags', 'question_tags', 'quiz_tags',
            'quiz_attempts', 'quiz_attempt_questions', 'feedback',
            'question_publication_events'
        )
    `);
    assert.equal(tables.rows[0].count, 13);

    await database.query("INSERT INTO auth.users (id) VALUES ($1)", [userId]);
    await database.query("INSERT INTO public.profiles (id, display_name) VALUES ($1, 'Tester')", [
        userId,
    ]);
    await database.query("INSERT INTO public.questions (id, created_by) VALUES ($1, $2)", [
        questionId,
        userId,
    ]);
    await database.query("INSERT INTO public.questions (id, created_by) VALUES ($1, $2)", [
        otherQuestionId,
        userId,
    ]);
    await database.query(
        `INSERT INTO public.question_versions
         (id, question_id, version_number, prompt, question_type, answer_config, grading_config, created_by)
         VALUES ($1, $2, 1, 'Prompt', 'exact_text', '{}', '{}', $3)`,
        [questionVersionId, questionId, userId],
    );
    await database.query("UPDATE public.questions SET current_version_id = $1 WHERE id = $2", [
        questionVersionId,
        questionId,
    ]);
    await assert.rejects(
        database.query(
            `INSERT INTO public.question_versions
             (question_id, version_number, prompt, question_type, answer_config, grading_config, created_by)
             VALUES ($1, 1, 'Duplicate', 'exact_text', '{}', '{}', $2)`,
            [questionId, userId],
        ),
        { code: "23505" },
    );
    await assert.rejects(
        database.query("UPDATE public.questions SET current_version_id = $1 WHERE id = $2", [
            questionVersionId,
            otherQuestionId,
        ]),
        { code: "23503" },
    );
    await assert.rejects(
        database.query("UPDATE public.question_versions SET prompt = 'Changed' WHERE id = $1", [
            questionVersionId,
        ]),
    );

    await database.query("INSERT INTO public.quizzes (id, created_by) VALUES ($1, $2)", [
        quizId,
        userId,
    ]);
    await database.query(
        `INSERT INTO public.quiz_versions (id, quiz_id, version_number, title, settings, created_by)
         VALUES ($1, $2, 1, 'Quiz', '{}', $3)`,
        [quizVersionId, quizId, userId],
    );
    await database.query("UPDATE public.quizzes SET current_version_id = $1 WHERE id = $2", [
        quizVersionId,
        quizId,
    ]);
    await assert.rejects(
        database.query(
            `INSERT INTO public.quiz_versions (quiz_id, version_number, title, settings, created_by)
             VALUES ($1, 1, 'Duplicate', '{}', $2)`,
            [quizId, userId],
        ),
        { code: "23505" },
    );
    await database.query(
        `INSERT INTO public.quiz_version_questions
         (id, quiz_version_id, question_id, question_version_id, position, points)
         VALUES ($1, $2, $3, $4, 0, 2.5)`,
        [membershipId, quizVersionId, questionId, questionVersionId],
    );
    await assert.rejects(
        database.query(
            `INSERT INTO public.quiz_version_questions
             (quiz_version_id, question_id, question_version_id, position, points)
             VALUES ($1, $2, $3, 1, 1)`,
            [quizVersionId, otherQuestionId, questionVersionId],
        ),
        { code: "23503" },
    );
    await assert.rejects(
        database.query("UPDATE public.quiz_version_questions SET points = 3 WHERE id = $1", [
            membershipId,
        ]),
    );

    await database.query(
        `INSERT INTO public.quiz_attempts (id, quiz_version_id, user_id, settings_snapshot)
         VALUES ($1, $2, $3, '{}')`,
        [attemptId, quizVersionId, userId],
    );
    await assert.rejects(
        database.query(
            `INSERT INTO public.quiz_attempt_questions
             (quiz_attempt_id, quiz_version_question_id, position, question_snapshot,
              answer_snapshot, grading_snapshot, points_possible)
             VALUES ($1, $2, 0, '{}', '{}', '{}', 3)`,
            [attemptId, membershipId],
        ),
        { code: "23514" },
    );
    await database.query(
        `INSERT INTO public.quiz_attempt_questions
         (id, quiz_attempt_id, quiz_version_question_id, position, question_snapshot,
          answer_snapshot, grading_snapshot, points_possible)
         VALUES ($1, $2, $3, 0, '{}', '{}', '{}', 2.5)`,
        [attemptQuestionId, attemptId, membershipId],
    );
    await assert.rejects(
        database.query(
            "UPDATE public.quiz_attempt_questions SET question_snapshot = '{\"changed\":true}' WHERE id = $1",
            [attemptQuestionId],
        ),
    );
    await database.query(
        `UPDATE public.quiz_attempt_questions SET points_awarded = 1.25,
         user_response = '{}', evaluation_result = '{}' WHERE id = $1`,
        [attemptQuestionId],
    );

    await assert.rejects(
        database.query(
            `INSERT INTO public.feedback (submitted_by, category, comment)
             VALUES ($1, 'other', 'Missing target')`,
            [userId],
        ),
        { code: "23514" },
    );
    await assert.rejects(
        database.query(
            `INSERT INTO public.feedback (submitted_by, question_id, quiz_id, category, comment)
             VALUES ($1, $2, $3, 'other', 'Two targets')`,
            [userId, questionId, quizId],
        ),
        { code: "23514" },
    );
    await database.query(
        `INSERT INTO public.feedback (submitted_by, question_id, category, comment)
         VALUES ($1, $2, 'other', 'One target')`,
        [userId, questionId],
    );

    const rls = await database.query(`
        SELECT count(*)::int AS count FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity
    `);
    assert.equal(rls.rows[0].count, 13);
    console.log(`Applied ${migrationNames.length} migration(s); schema constraints passed.`);
} finally {
    await database.close();
}
