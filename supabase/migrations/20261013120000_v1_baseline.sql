-- Clean V1 baseline. Existing installations require the explicit application rebuild.
-- Supabase owns auth.users; Express owns application authorization.
CREATE TYPE public.content_visibility AS ENUM ('private', 'public');
CREATE TYPE public.question_type AS ENUM ('exact_text', 'multiple_choice_single', 'multiple_choice_multi');
CREATE TYPE public.quiz_attempt_status AS ENUM ('in_progress', 'completed', 'abandoned', 'expired');
CREATE TYPE public.feedback_category AS ENUM ('incorrect_answer', 'ambiguous_question', 'typo', 'bad_choices', 'unfair_grading', 'too_easy', 'too_hard', 'other');
CREATE TYPE public.feedback_status AS ENUM ('open', 'reviewed', 'resolved', 'dismissed');
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id),
  display_name text NOT NULL CHECK (length(trim(display_name)) > 0),
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);


CREATE TABLE public.questions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 created_by uuid NOT NULL REFERENCES public.profiles(id),
 visibility public.content_visibility NOT NULL DEFAULT 'private',
 prompt text NOT NULL CHECK (length(trim(prompt)) > 0),
 question_type public.question_type NOT NULL,
 answer_config jsonb NOT NULL CHECK (jsonb_typeof(answer_config) = 'object'),
 grading_config jsonb NOT NULL CHECK (jsonb_typeof(grading_config) = 'object'),
 explanation text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 content_locked_at timestamptz
);
CREATE TABLE public.quizzes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_by uuid NOT NULL REFERENCES public.profiles(id),
 visibility public.content_visibility NOT NULL DEFAULT 'private',
 title text NOT NULL CHECK (length(trim(title)) > 0), description text,
 settings jsonb NOT NULL CHECK (jsonb_typeof(settings) = 'object'),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.quiz_questions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), quiz_id uuid NOT NULL REFERENCES public.quizzes(id),
 question_id uuid NOT NULL REFERENCES public.questions(id), position integer NOT NULL CHECK (position >= 0),
 points numeric NOT NULL CHECK (points >= 0 AND points <> 'NaN'::numeric AND points <> 'Infinity'::numeric),
 required boolean NOT NULL DEFAULT true, time_limit_seconds integer CHECK (time_limit_seconds > 0),
 UNIQUE(quiz_id, position)
);
CREATE TABLE public.courses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL CHECK (length(trim(title)) > 0),
 description text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.lessons (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), course_id uuid NOT NULL REFERENCES public.courses(id),
 title text NOT NULL CHECK (length(trim(title)) > 0), description text, content text NOT NULL DEFAULT '',
 position integer NOT NULL CHECK (position >= 0),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(course_id, position)
);
CREATE TABLE public.lesson_quizzes (
 lesson_id uuid NOT NULL REFERENCES public.lessons(id), quiz_id uuid NOT NULL REFERENCES public.quizzes(id),
 position integer NOT NULL CHECK (position >= 0), PRIMARY KEY(lesson_id, quiz_id), UNIQUE(lesson_id, position)
);
CREATE TABLE public.tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles (id),
  name text NOT NULL CHECK (length(trim(name)) > 0),
  slug text NOT NULL CHECK (length(trim(slug)) > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tags_owner_slug_unique UNIQUE (created_by, slug)
);

CREATE TABLE public.question_tags (
  question_id uuid NOT NULL REFERENCES public.questions (id),
  tag_id uuid NOT NULL REFERENCES public.tags (id),
  PRIMARY KEY (question_id, tag_id)
);

CREATE TABLE public.quiz_tags (
  quiz_id uuid NOT NULL REFERENCES public.quizzes (id),
  tag_id uuid NOT NULL REFERENCES public.tags (id),
  PRIMARY KEY (quiz_id, tag_id)
);

CREATE TABLE public.quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes (id),
  quiz_title_snapshot text NOT NULL CHECK (length(trim(quiz_title_snapshot)) > 0),
  user_id uuid NOT NULL REFERENCES public.profiles (id),
  status public.quiz_attempt_status NOT NULL DEFAULT 'in_progress',
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  settings_snapshot jsonb NOT NULL CHECK (jsonb_typeof(settings_snapshot) = 'object'),
  score_summary jsonb CHECK (score_summary IS NULL OR jsonb_typeof(score_summary) = 'object'),
  CHECK (completed_at IS NULL OR completed_at >= started_at)
);

CREATE TABLE public.quiz_attempt_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_attempt_id uuid NOT NULL REFERENCES public.quiz_attempts (id),
  question_id uuid NOT NULL REFERENCES public.questions (id),
  required boolean NOT NULL,
  time_limit_seconds integer CHECK (time_limit_seconds > 0),
  position integer NOT NULL CHECK (position >= 0),
  question_snapshot jsonb NOT NULL CHECK (jsonb_typeof(question_snapshot) = 'object'),
  answer_snapshot jsonb NOT NULL CHECK (jsonb_typeof(answer_snapshot) = 'object'),
  grading_snapshot jsonb NOT NULL CHECK (jsonb_typeof(grading_snapshot) = 'object'),
  user_response jsonb CHECK (user_response IS NULL OR jsonb_typeof(user_response) = 'object'),
  evaluation_result jsonb CHECK (evaluation_result IS NULL OR jsonb_typeof(evaluation_result) = 'object'),
  started_at timestamptz,
  answered_at timestamptz,
  time_spent_ms bigint CHECK (time_spent_ms >= 0),
  points_possible numeric NOT NULL CHECK (points_possible >= 0 AND points_possible <> 'NaN'::numeric AND points_possible <> 'Infinity'::numeric),
  points_awarded numeric,
  CONSTRAINT quiz_attempt_questions_position_unique UNIQUE (quiz_attempt_id, position)
);

CREATE TABLE public.feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL REFERENCES public.profiles (id),
  question_id uuid REFERENCES public.questions (id),
  quiz_id uuid REFERENCES public.quizzes (id),
  quiz_attempt_question_id uuid REFERENCES public.quiz_attempt_questions (id),
  category public.feedback_category NOT NULL,
  comment text NOT NULL CHECK (length(trim(comment)) > 0),
  status public.feedback_status NOT NULL DEFAULT 'open',
  created_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  CONSTRAINT feedback_exactly_one_target CHECK (
    num_nonnulls(question_id, quiz_id, quiz_attempt_question_id) = 1
  )
);

-- A validated batch artifact is retained before its questions are materialized.
CREATE TABLE public.question_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.profiles (id),
  batch_key uuid NOT NULL,
  artifact jsonb NOT NULL CHECK (
    jsonb_typeof(artifact) = 'object'
    AND artifact->>'batchKey' IS NOT NULL
    AND lower(artifact->>'batchKey') = batch_key::text
  ),
  artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sponsor_id, batch_key)
);

CREATE TABLE public.question_batch_items (
  batch_id uuid NOT NULL REFERENCES public.question_batches (id),
  item_key text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  question_id uuid NOT NULL REFERENCES public.questions (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, item_key),
  UNIQUE (batch_id, position),
  UNIQUE (question_id)
);

CREATE INDEX questions_owner_idx ON public.questions(created_by);
CREATE INDEX questions_visibility_idx ON public.questions(visibility);
CREATE INDEX quizzes_owner_idx ON public.quizzes(created_by);
CREATE INDEX quizzes_visibility_idx ON public.quizzes(visibility);
CREATE INDEX quiz_questions_question_idx ON public.quiz_questions(question_id);
CREATE INDEX lesson_quizzes_quiz_idx ON public.lesson_quizzes(quiz_id);
CREATE INDEX question_tags_tag_idx ON public.question_tags(tag_id);
CREATE INDEX quiz_tags_tag_idx ON public.quiz_tags(tag_id);
CREATE INDEX quiz_attempts_user_started_idx ON public.quiz_attempts(user_id, started_at DESC);
CREATE INDEX quiz_attempts_quiz_idx ON public.quiz_attempts(quiz_id);
CREATE INDEX quiz_attempt_questions_question_idx ON public.quiz_attempt_questions(question_id);
CREATE INDEX feedback_question_idx ON public.feedback(question_id) WHERE question_id IS NOT NULL;
CREATE INDEX feedback_quiz_idx ON public.feedback(quiz_id) WHERE quiz_id IS NOT NULL;
CREATE INDEX feedback_attempt_question_idx ON public.feedback(quiz_attempt_question_id) WHERE quiz_attempt_question_id IS NOT NULL;
CREATE FUNCTION public.reject_immutable_row_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Rows in % are immutable', TG_TABLE_NAME USING ERRCODE = '23514'; END; $$;

-- All composition/attempt writers lock the quiz first, then questions in ID order.
CREATE FUNCTION public.guard_question() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
  RAISE EXCEPTION 'Question identity is immutable' USING ERRCODE = '23514';
 END IF;
 IF OLD.content_locked_at IS NOT NULL AND (
  NEW.content_locked_at IS DISTINCT FROM OLD.content_locked_at OR
  ROW(NEW.prompt,NEW.question_type,NEW.answer_config,NEW.grading_config,NEW.explanation)
   IS DISTINCT FROM ROW(OLD.prompt,OLD.question_type,OLD.answer_config,OLD.grading_config,OLD.explanation)) THEN
  RAISE EXCEPTION 'Used question content is permanently locked' USING ERRCODE = '23514';
 END IF;
 IF NEW.visibility IS DISTINCT FROM OLD.visibility THEN
  PERFORM q.id FROM public.quizzes q JOIN public.quiz_questions m ON m.quiz_id=q.id
    WHERE m.question_id=OLD.id ORDER BY q.id FOR SHARE OF q;
  IF EXISTS(SELECT 1 FROM public.quiz_questions m JOIN public.quizzes q ON q.id=m.quiz_id
   WHERE m.question_id=OLD.id AND (q.visibility='public' AND NEW.visibility<>'public'
     OR q.visibility='private' AND NEW.visibility='private' AND q.created_by<>NEW.created_by)) THEN
   RAISE EXCEPTION 'Question access conflicts with quiz membership' USING ERRCODE = '23514';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER questions_guard BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.guard_question();
CREATE FUNCTION public.guard_quiz() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
  RAISE EXCEPTION 'Quiz identity is immutable' USING ERRCODE = '23514';
 END IF;
 IF ROW(NEW.title,NEW.description,NEW.settings) IS DISTINCT FROM ROW(OLD.title,OLD.description,OLD.settings)
  AND EXISTS(SELECT 1 FROM public.quiz_attempts WHERE quiz_id=OLD.id) THEN
  RAISE EXCEPTION 'Attempted quiz content is locked' USING ERRCODE = '23514';
 END IF;
 IF NEW.visibility IS DISTINCT FROM OLD.visibility THEN
  PERFORM q.id FROM public.questions q JOIN public.quiz_questions m ON m.question_id=q.id
    WHERE m.quiz_id=OLD.id ORDER BY q.id FOR SHARE OF q;
  IF EXISTS(SELECT 1 FROM public.quiz_questions m JOIN public.questions q ON q.id=m.question_id
    WHERE m.quiz_id=OLD.id AND (NEW.visibility='public' AND q.visibility<>'public'
      OR NEW.visibility='private' AND q.visibility='private' AND q.created_by<>NEW.created_by))
    OR NEW.visibility<>'public' AND EXISTS(SELECT 1 FROM public.lesson_quizzes WHERE quiz_id=OLD.id) THEN
   RAISE EXCEPTION 'Quiz access conflicts with its questions or lessons' USING ERRCODE = '23514';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER quizzes_guard BEFORE UPDATE ON public.quizzes FOR EACH ROW EXECUTE FUNCTION public.guard_quiz();
CREATE FUNCTION public.guard_composition() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent public.quizzes; source public.questions;
BEGIN
 IF TG_OP='UPDATE' AND ROW(NEW.id,NEW.quiz_id) IS DISTINCT FROM ROW(OLD.id,OLD.quiz_id) THEN
  RAISE EXCEPTION 'Membership identity is immutable' USING ERRCODE = '23514';
 END IF;
 SELECT * INTO parent FROM public.quizzes WHERE id=CASE WHEN TG_OP='DELETE' THEN OLD.quiz_id ELSE NEW.quiz_id END FOR UPDATE;
 IF EXISTS(SELECT 1 FROM public.quiz_attempts WHERE quiz_id=parent.id)
  AND (TG_OP<>'UPDATE' OR NEW IS DISTINCT FROM OLD) THEN
  RAISE EXCEPTION 'Attempted quiz composition is locked' USING ERRCODE = '23514';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 SELECT * INTO source FROM public.questions WHERE id=NEW.question_id FOR UPDATE;
 IF parent.visibility='public' AND source.visibility<>'public'
  OR parent.visibility='private' AND source.visibility='private' AND parent.created_by<>source.created_by THEN
  RAISE EXCEPTION 'Question is not eligible for this quiz' USING ERRCODE = '23514';
 END IF;
 UPDATE public.questions SET content_locked_at=COALESCE(content_locked_at,now()) WHERE id=source.id;
 RETURN NEW;
END; $$;
CREATE TRIGGER quiz_questions_guard BEFORE INSERT OR UPDATE OR DELETE ON public.quiz_questions FOR EACH ROW EXECUTE FUNCTION public.guard_composition();
CREATE FUNCTION public.guard_lesson_quiz() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE access public.content_visibility;
BEGIN
 SELECT visibility INTO access FROM public.quizzes WHERE id=NEW.quiz_id FOR UPDATE;
 IF access<>'public' THEN RAISE EXCEPTION 'Lessons require public quizzes' USING ERRCODE = '23514'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER lesson_quizzes_guard BEFORE INSERT OR UPDATE ON public.lesson_quizzes FOR EACH ROW EXECUTE FUNCTION public.guard_lesson_quiz();
CREATE FUNCTION public.guard_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source public.quizzes;
BEGIN
 IF TG_OP='INSERT' THEN
  SELECT * INTO source FROM public.quizzes WHERE id=NEW.quiz_id FOR UPDATE;
  IF NEW.quiz_title_snapshot IS DISTINCT FROM source.title OR NEW.settings_snapshot IS DISTINCT FROM source.settings
    OR NOT EXISTS(SELECT 1 FROM public.quiz_questions WHERE quiz_id=NEW.quiz_id) THEN
   RAISE EXCEPTION 'Attempt must snapshot a nonempty quiz' USING ERRCODE = '23514';
  END IF;
 ELSE
  IF OLD.status<>'in_progress' AND NEW IS DISTINCT FROM OLD THEN
   RAISE EXCEPTION 'Closed attempt results are immutable' USING ERRCODE = '23514';
  END IF;
  IF ROW(NEW.id,NEW.quiz_id,NEW.user_id,NEW.started_at,NEW.quiz_title_snapshot,NEW.settings_snapshot)
   IS DISTINCT FROM ROW(OLD.id,OLD.quiz_id,OLD.user_id,OLD.started_at,OLD.quiz_title_snapshot,OLD.settings_snapshot) THEN
   RAISE EXCEPTION 'Attempt identity and snapshots are immutable' USING ERRCODE = '23514';
  END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER quiz_attempts_guard BEFORE INSERT OR UPDATE ON public.quiz_attempts FOR EACH ROW EXECUTE FUNCTION public.guard_attempt();
CREATE TRIGGER quiz_attempts_preserve BEFORE DELETE ON public.quiz_attempts FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_change();
CREATE FUNCTION public.guard_attempt_question() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE attempt public.quiz_attempts;
BEGIN
 SELECT * INTO attempt FROM public.quiz_attempts WHERE id=NEW.quiz_attempt_id FOR UPDATE;
 IF TG_OP='UPDATE' THEN
  IF ROW(NEW.id,NEW.quiz_attempt_id,NEW.question_id,NEW.position,NEW.question_snapshot,NEW.answer_snapshot,NEW.grading_snapshot,NEW.points_possible,NEW.required,NEW.time_limit_seconds)
    IS DISTINCT FROM ROW(OLD.id,OLD.quiz_attempt_id,OLD.question_id,OLD.position,OLD.question_snapshot,OLD.answer_snapshot,OLD.grading_snapshot,OLD.points_possible,OLD.required,OLD.time_limit_seconds) THEN
   RAISE EXCEPTION 'Attempt question snapshots are immutable' USING ERRCODE = '23514';
  END IF;
  IF attempt.status<>'in_progress' AND NEW IS DISTINCT FROM OLD THEN
   RAISE EXCEPTION 'Closed attempt answers are immutable' USING ERRCODE = '23514';
  END IF;
 ELSE
  IF attempt.status<>'in_progress' OR NOT EXISTS (
    SELECT 1 FROM public.quiz_questions m JOIN public.questions q ON q.id=m.question_id
    WHERE m.quiz_id=attempt.quiz_id AND q.id=NEW.question_id AND m.points=NEW.points_possible
      AND m.required=NEW.required AND m.time_limit_seconds IS NOT DISTINCT FROM NEW.time_limit_seconds
      AND NEW.question_snapshot=jsonb_build_object('questionId',q.id,'prompt',q.prompt,'questionType',q.question_type,'explanation',q.explanation)
      AND NEW.answer_snapshot=q.answer_config AND NEW.grading_snapshot=q.grading_config
   ) THEN RAISE EXCEPTION 'Attempt question must snapshot quiz membership' USING ERRCODE = '23514'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER quiz_attempt_questions_guard BEFORE INSERT OR UPDATE ON public.quiz_attempt_questions FOR EACH ROW EXECUTE FUNCTION public.guard_attempt_question();
CREATE TRIGGER quiz_attempt_questions_preserve BEFORE DELETE ON public.quiz_attempt_questions FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_change();
-- Deferred set validation makes the initial snapshot atomic and prevents later additions.
CREATE FUNCTION public.check_complete_attempt_snapshot() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE attempt_id uuid; source_set jsonb; snapshot_set jsonb; source_count integer; max_position integer;
BEGIN
 IF TG_TABLE_NAME='quiz_attempts' THEN attempt_id := NEW.id; ELSE attempt_id := NEW.quiz_attempt_id; END IF;
 SELECT jsonb_agg(jsonb_build_array(m.question_id,m.points,m.required,m.time_limit_seconds)
   ORDER BY m.question_id,m.points,m.required,m.time_limit_seconds),count(*)
 INTO source_set,source_count FROM public.quiz_questions m JOIN public.quiz_attempts a ON a.quiz_id=m.quiz_id WHERE a.id=attempt_id;
 SELECT jsonb_agg(jsonb_build_array(question_id,points_possible,required,time_limit_seconds)
   ORDER BY question_id,points_possible,required,time_limit_seconds),max(position)
 INTO snapshot_set,max_position FROM public.quiz_attempt_questions WHERE quiz_attempt_id=attempt_id;
 IF source_set IS DISTINCT FROM snapshot_set OR max_position IS DISTINCT FROM source_count-1 THEN
  RAISE EXCEPTION 'Attempt requires a complete immutable composition snapshot' USING ERRCODE = '23514';
 END IF;
 RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER quiz_attempts_complete_snapshot AFTER INSERT ON public.quiz_attempts
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_complete_attempt_snapshot();
CREATE CONSTRAINT TRIGGER quiz_attempt_questions_complete_snapshot AFTER INSERT ON public.quiz_attempt_questions
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.check_complete_attempt_snapshot();
CREATE TRIGGER question_batches_immutable BEFORE UPDATE OR DELETE ON public.question_batches FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_change();
CREATE TRIGGER question_batch_items_immutable BEFORE UPDATE OR DELETE ON public.question_batch_items FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_change();
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempt_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_batch_items ENABLE ROW LEVEL SECURITY;
;
