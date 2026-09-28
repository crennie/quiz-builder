-- SQL migrations are the database schema source of truth.
-- Application tables are accessed through the backend; RLS closes direct Data API access.

CREATE TYPE public.content_visibility AS ENUM ('private', 'unlisted', 'public');
CREATE TYPE public.content_status AS ENUM ('draft', 'published', 'archived');
CREATE TYPE public.question_type AS ENUM ('exact_text', 'multiple_choice_single', 'multiple_choice_multi');
CREATE TYPE public.quiz_attempt_status AS ENUM ('in_progress', 'completed', 'abandoned', 'expired');
CREATE TYPE public.feedback_category AS ENUM (
  'incorrect_answer', 'ambiguous_question', 'typo', 'bad_choices',
  'unfair_grading', 'too_easy', 'too_hard', 'other'
);
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
  created_by uuid NOT NULL REFERENCES public.profiles (id),
  current_version_id uuid,
  visibility public.content_visibility NOT NULL DEFAULT 'private',
  status public.content_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.question_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions (id),
  version_number integer NOT NULL CHECK (version_number > 0),
  prompt text NOT NULL CHECK (length(trim(prompt)) > 0),
  question_type public.question_type NOT NULL,
  answer_config jsonb NOT NULL CHECK (jsonb_typeof(answer_config) = 'object'),
  grading_config jsonb NOT NULL CHECK (jsonb_typeof(grading_config) = 'object'),
  explanation text,
  created_by uuid NOT NULL REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT question_versions_number_unique UNIQUE (question_id, version_number),
  CONSTRAINT question_versions_identity_unique UNIQUE (question_id, id)
);

ALTER TABLE public.questions
  ADD CONSTRAINT questions_current_version_fkey
  FOREIGN KEY (id, current_version_id)
  REFERENCES public.question_versions (question_id, id);

CREATE TABLE public.quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES public.profiles (id),
  current_version_id uuid,
  visibility public.content_visibility NOT NULL DEFAULT 'private',
  status public.content_status NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.quiz_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.quizzes (id),
  version_number integer NOT NULL CHECK (version_number > 0),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  description text,
  settings jsonb NOT NULL CHECK (jsonb_typeof(settings) = 'object'),
  created_by uuid NOT NULL REFERENCES public.profiles (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quiz_versions_number_unique UNIQUE (quiz_id, version_number),
  CONSTRAINT quiz_versions_identity_unique UNIQUE (quiz_id, id)
);

ALTER TABLE public.quizzes
  ADD CONSTRAINT quizzes_current_version_fkey
  FOREIGN KEY (id, current_version_id)
  REFERENCES public.quiz_versions (quiz_id, id);

CREATE TABLE public.quiz_version_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_version_id uuid NOT NULL REFERENCES public.quiz_versions (id),
  question_id uuid NOT NULL REFERENCES public.questions (id),
  question_version_id uuid NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  points numeric NOT NULL CHECK (points >= 0),
  required boolean NOT NULL DEFAULT true,
  time_limit_seconds integer CHECK (time_limit_seconds > 0),
  CONSTRAINT quiz_version_questions_position_unique UNIQUE (quiz_version_id, position),
  CONSTRAINT quiz_version_questions_question_version_fkey
    FOREIGN KEY (question_id, question_version_id)
    REFERENCES public.question_versions (question_id, id)
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
  quiz_version_id uuid NOT NULL REFERENCES public.quiz_versions (id),
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
  quiz_version_question_id uuid NOT NULL REFERENCES public.quiz_version_questions (id),
  position integer NOT NULL CHECK (position >= 0),
  question_snapshot jsonb NOT NULL CHECK (jsonb_typeof(question_snapshot) = 'object'),
  answer_snapshot jsonb NOT NULL CHECK (jsonb_typeof(answer_snapshot) = 'object'),
  grading_snapshot jsonb NOT NULL CHECK (jsonb_typeof(grading_snapshot) = 'object'),
  user_response jsonb CHECK (user_response IS NULL OR jsonb_typeof(user_response) = 'object'),
  evaluation_result jsonb CHECK (evaluation_result IS NULL OR jsonb_typeof(evaluation_result) = 'object'),
  started_at timestamptz,
  answered_at timestamptz,
  time_spent_ms bigint CHECK (time_spent_ms >= 0),
  points_possible numeric NOT NULL CHECK (points_possible >= 0),
  points_awarded numeric,
  CONSTRAINT quiz_attempt_questions_position_unique UNIQUE (quiz_attempt_id, position),
  CONSTRAINT quiz_attempt_questions_membership_unique UNIQUE (quiz_attempt_id, quiz_version_question_id)
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

CREATE INDEX questions_owner_idx ON public.questions (created_by);
CREATE INDEX questions_visibility_status_idx ON public.questions (visibility, status);
CREATE INDEX quizzes_owner_idx ON public.quizzes (created_by);
CREATE INDEX quizzes_visibility_status_idx ON public.quizzes (visibility, status);
CREATE INDEX quiz_version_questions_question_idx ON public.quiz_version_questions (question_id);
CREATE INDEX question_tags_tag_idx ON public.question_tags (tag_id);
CREATE INDEX quiz_tags_tag_idx ON public.quiz_tags (tag_id);
CREATE INDEX quiz_attempts_user_started_idx ON public.quiz_attempts (user_id, started_at DESC);
CREATE INDEX quiz_attempts_quiz_version_idx ON public.quiz_attempts (quiz_version_id);
CREATE INDEX quiz_attempt_questions_version_question_idx ON public.quiz_attempt_questions (quiz_version_question_id);
CREATE INDEX feedback_question_idx ON public.feedback (question_id) WHERE question_id IS NOT NULL;
CREATE INDEX feedback_quiz_idx ON public.feedback (quiz_id) WHERE quiz_id IS NOT NULL;
CREATE INDEX feedback_attempt_question_idx ON public.feedback (quiz_attempt_question_id) WHERE quiz_attempt_question_id IS NOT NULL;

CREATE FUNCTION public.reject_immutable_row_change() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Rows in % are immutable', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER question_versions_immutable BEFORE UPDATE OR DELETE ON public.question_versions
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_change();
CREATE TRIGGER quiz_versions_immutable BEFORE UPDATE OR DELETE ON public.quiz_versions
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_change();
CREATE TRIGGER quiz_version_questions_immutable BEFORE UPDATE OR DELETE ON public.quiz_version_questions
FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_change();

CREATE FUNCTION public.protect_attempt_snapshots() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD.quiz_version_id, OLD.user_id, OLD.settings_snapshot)
     IS DISTINCT FROM ROW(NEW.quiz_version_id, NEW.user_id, NEW.settings_snapshot) THEN
    RAISE EXCEPTION 'Quiz attempt identity and settings snapshot are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER quiz_attempts_snapshot_immutable BEFORE UPDATE ON public.quiz_attempts
FOR EACH ROW EXECUTE FUNCTION public.protect_attempt_snapshots();

CREATE FUNCTION public.check_attempt_question_membership() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.quiz_attempts a
    JOIN public.quiz_version_questions q ON q.id = NEW.quiz_version_question_id
    WHERE a.id = NEW.quiz_attempt_id
      AND a.quiz_version_id = q.quiz_version_id
      AND NEW.points_possible = q.points
  ) THEN
    RAISE EXCEPTION 'Attempt question must match its quiz version and points'
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER quiz_attempt_questions_membership_check BEFORE INSERT ON public.quiz_attempt_questions
FOR EACH ROW EXECUTE FUNCTION public.check_attempt_question_membership();

CREATE FUNCTION public.protect_attempt_question_snapshots() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF ROW(OLD.quiz_attempt_id, OLD.quiz_version_question_id, OLD.position,
         OLD.question_snapshot, OLD.answer_snapshot, OLD.grading_snapshot, OLD.points_possible)
     IS DISTINCT FROM ROW(NEW.quiz_attempt_id, NEW.quiz_version_question_id, NEW.position,
                          NEW.question_snapshot, NEW.answer_snapshot, NEW.grading_snapshot, NEW.points_possible) THEN
    RAISE EXCEPTION 'Attempt question identity and snapshots are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER quiz_attempt_questions_snapshot_immutable BEFORE UPDATE ON public.quiz_attempt_questions
FOR EACH ROW EXECUTE FUNCTION public.protect_attempt_question_snapshots();

-- No direct Data API policies are defined. Express authorization is the v1 access boundary.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_version_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempt_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;
