-- Read-only V1 schema verification. Each value must be true.
SELECT
  (SELECT count(*)=16 FROM pg_tables WHERE schemaname='public' AND tablename IN ('profiles','questions','quizzes','quiz_questions','quiz_attempts','quiz_attempt_questions','courses','course_imports','lessons','lesson_quizzes','tags','question_tags','quiz_tags','feedback','question_batches','question_batch_items')) AS check_1,
  NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND column_name ~ '(version|agent|work_item|published)') AS check_2,
  (SELECT count(*)=1 FROM pg_constraint WHERE conname='feedback_exactly_one_target' AND contype='c') AS check_3,
  (SELECT count(*)=16 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity) AS check_4,
  NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public') AS check_5,
  (SELECT count(*)=12 FROM pg_trigger WHERE NOT tgisinternal AND tgname IN ('questions_guard','quizzes_guard','quiz_questions_guard','lesson_quizzes_guard','quiz_attempts_guard','quiz_attempts_preserve','quiz_attempt_questions_guard','quiz_attempt_questions_preserve','question_batches_immutable','question_batch_items_immutable','quiz_attempts_complete_snapshot','quiz_attempt_questions_complete_snapshot')) AS check_6,
  (SELECT array_agg(e.enumlabel::text ORDER BY e.enumsortorder)=ARRAY['private','public'] FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='content_visibility') AS check_7;
