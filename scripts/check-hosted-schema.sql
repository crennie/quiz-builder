-- Read-only hosted verification after the current migrations.
SELECT
  (SELECT count(*) = 23 FROM pg_tables WHERE schemaname = 'public'
   AND tablename IN (
     'profiles', 'questions', 'question_versions', 'quizzes', 'quiz_versions',
     'quiz_version_questions', 'tags', 'question_tags', 'quiz_tags',
     'quiz_attempts', 'quiz_attempt_questions', 'feedback',
     'question_publication_events', 'question_review_submissions',
     'question_review_decisions', 'question_publication_gate_decisions',
     'work_items', 'work_item_events', 'agent_actors', 'agent_generation_runs',
     'agent_execution_runs', 'question_batches', 'question_batch_items'
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
  (SELECT count(*) = 6 FROM pg_constraint
   WHERE conname IN ('questions_agent_origin_run_id_fkey',
     'question_versions_agent_run_id_fkey', 'work_items_claimed_agent_actor_id_fkey',
     'work_items_assigned_agent_actor_id_fkey',
     'question_review_decisions_agent_execution_run_id_fkey',
     'question_publication_gate_decisions_agent_execution_run_id_fkey')
   AND contype = 'f') AS agent_provenance_fks_ok,
  (SELECT count(*) = 1 FROM pg_constraint
   WHERE conname = 'question_batch_items_version_fkey'
   AND contype = 'f') AS batch_version_fk_ok,
  (SELECT count(*) = 14 FROM pg_trigger
   WHERE tgname IN (
     'question_versions_immutable', 'quiz_versions_immutable',
     'quiz_version_questions_immutable', 'quiz_attempts_snapshot_immutable',
     'quiz_attempt_questions_snapshot_immutable',
     'question_publication_events_immutable',
     'question_review_submissions_immutable', 'question_review_decisions_immutable',
     'question_publication_gate_decisions_immutable', 'work_item_events_immutable',
     'agent_generation_runs_immutable', 'agent_execution_runs_immutable',
     'question_batches_immutable', 'question_batch_items_immutable'
   ) AND NOT tgisinternal) AS immutable_triggers_ok,
  (SELECT count(*) = 23 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity) AS rls_ok;
