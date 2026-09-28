-- Read-only hosted verification after the initial migration.
SELECT
  (SELECT count(*) = 12 FROM pg_tables WHERE schemaname = 'public'
   AND tablename IN (
     'profiles', 'questions', 'question_versions', 'quizzes', 'quiz_versions',
     'quiz_version_questions', 'tags', 'question_tags', 'quiz_tags',
     'quiz_attempts', 'quiz_attempt_questions', 'feedback'
   )) AS tables_ok,
  (SELECT count(*) = 2 FROM pg_constraint
   WHERE conname IN ('questions_current_version_fkey', 'quizzes_current_version_fkey')
   AND contype = 'f') AS current_version_fks_ok,
  (SELECT count(*) = 1 FROM pg_constraint
   WHERE conname = 'quiz_version_questions_question_version_fkey'
   AND contype = 'f') AS membership_fk_ok,
  (SELECT count(*) = 1 FROM pg_constraint
   WHERE conname = 'feedback_exactly_one_target'
   AND contype = 'c') AS feedback_target_check_ok,
  (SELECT count(*) = 5 FROM pg_trigger
   WHERE tgname IN (
     'question_versions_immutable', 'quiz_versions_immutable',
     'quiz_version_questions_immutable', 'quiz_attempts_snapshot_immutable',
     'quiz_attempt_questions_snapshot_immutable'
   ) AND NOT tgisinternal) AS immutable_triggers_ok,
  (SELECT count(*) = 12 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) AS rls_ok;
