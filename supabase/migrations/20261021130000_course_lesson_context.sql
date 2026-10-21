-- Keep existing lesson/quiz uniqueness while giving each association a durable identity.
ALTER TABLE public.lesson_quizzes ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid();
ALTER TABLE public.lesson_quizzes DROP CONSTRAINT lesson_quizzes_pkey;
ALTER TABLE public.lesson_quizzes ADD PRIMARY KEY (id);
ALTER TABLE public.lesson_quizzes ADD CONSTRAINT lesson_quizzes_lesson_quiz_unique UNIQUE (lesson_id, quiz_id);
ALTER TABLE public.quiz_attempts ADD COLUMN lesson_quiz_id uuid
    REFERENCES public.lesson_quizzes(id) ON UPDATE RESTRICT ON DELETE RESTRICT;
CREATE INDEX quiz_attempts_lesson_quiz_idx ON public.quiz_attempts(lesson_quiz_id)
    WHERE lesson_quiz_id IS NOT NULL;

-- Association identity never changes. Position can still be reordered. Restrictive FKs
-- retain the lesson and course; attempts cannot be relabelled with a different origin.
CREATE FUNCTION public.guard_lesson_quiz_identity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF ROW(NEW.id, NEW.lesson_id, NEW.quiz_id) IS DISTINCT FROM ROW(OLD.id, OLD.lesson_id, OLD.quiz_id) THEN
        RAISE EXCEPTION 'Lesson quiz identity is immutable; create a new association' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER lesson_quizzes_identity_guard BEFORE UPDATE ON public.lesson_quizzes
    FOR EACH ROW EXECUTE FUNCTION public.guard_lesson_quiz_identity();

CREATE FUNCTION public.guard_attempt_lesson_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.lesson_quiz_id IS DISTINCT FROM OLD.lesson_quiz_id THEN
            RAISE EXCEPTION 'Attempt lesson context is immutable' USING ERRCODE = '23514';
        END IF;
    ELSIF NEW.lesson_quiz_id IS NOT NULL THEN
        PERFORM id FROM public.quizzes WHERE id = NEW.quiz_id FOR UPDATE;
        PERFORM id FROM public.lesson_quizzes
            WHERE id = NEW.lesson_quiz_id AND quiz_id = NEW.quiz_id FOR KEY SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Lesson context must reference the attempted quiz' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER quiz_attempts_lesson_context_guard BEFORE INSERT OR UPDATE ON public.quiz_attempts
    FOR EACH ROW EXECUTE FUNCTION public.guard_attempt_lesson_context();

-- Retain a receipt for safe retries, scoped to the authenticated importer.
CREATE TABLE public.course_imports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    sponsor_id uuid NOT NULL REFERENCES public.profiles(id),
    import_key uuid NOT NULL,
    artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[a-f0-9]{64}$'),
    course_id uuid NOT NULL REFERENCES public.courses(id),
    lesson_ids uuid[] NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(sponsor_id, import_key)
);
ALTER TABLE public.course_imports ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER course_imports_immutable BEFORE UPDATE OR DELETE ON public.course_imports
    FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_change();
