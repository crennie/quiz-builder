BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET search_path = public, extensions;
SELECT plan(6);

SELECT ok(
  (SELECT count(*) = 12 FROM pg_tables WHERE schemaname = 'public'
   AND tablename IN (
     'profiles', 'questions', 'question_versions', 'quizzes', 'quiz_versions',
     'quiz_version_questions', 'tags', 'question_tags', 'quiz_tags',
     'quiz_attempts', 'quiz_attempt_questions', 'feedback'
   )),
  'all twelve V1 application tables exist'
);

SELECT ok(
  (SELECT count(*) = 2 FROM pg_constraint
   WHERE conname IN ('questions_current_version_fkey', 'quizzes_current_version_fkey')
   AND contype = 'f'),
  'current versions belong to their stable entities'
);

SELECT ok(
  (SELECT count(*) = 1 FROM pg_constraint
   WHERE conname = 'quiz_version_questions_question_version_fkey' AND contype = 'f'),
  'quiz membership references an explicit version of its question'
);

SELECT ok(
  (SELECT count(*) = 1 FROM pg_constraint
   WHERE conname = 'feedback_exactly_one_target' AND contype = 'c'),
  'feedback has an exactly-one-target check'
);

SELECT ok(
  (SELECT count(*) = 5 FROM pg_trigger
   WHERE tgname IN (
     'question_versions_immutable', 'quiz_versions_immutable',
     'quiz_version_questions_immutable', 'quiz_attempts_snapshot_immutable',
     'quiz_attempt_questions_snapshot_immutable'
   ) AND NOT tgisinternal),
  'versions and attempt snapshots have immutability triggers'
);

SELECT ok(
  (SELECT count(*) = 12 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity),
  'all application tables have RLS enabled'
);

SELECT * FROM finish();
ROLLBACK;
