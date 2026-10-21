-- Archiving preserves source identities, composition, feedback, and all attempt history.
ALTER TABLE public.quizzes ADD COLUMN archived_at timestamptz;
ALTER TABLE public.quizzes ADD CONSTRAINT quizzes_archive_private
    CHECK (archived_at IS NULL OR visibility = 'private');
CREATE INDEX quizzes_owner_archive_idx ON public.quizzes (created_by, archived_at);

-- Serialize archive/start operations on the same parent row, including direct SQL.
CREATE FUNCTION public.reject_archived_quiz_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    PERFORM id FROM public.quizzes WHERE id = NEW.quiz_id FOR UPDATE;
    IF EXISTS (SELECT 1 FROM public.quizzes WHERE id = NEW.quiz_id AND archived_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Archived quizzes cannot start new attempts' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER quiz_attempts_archive_guard BEFORE INSERT ON public.quiz_attempts
    FOR EACH ROW EXECUTE FUNCTION public.reject_archived_quiz_attempt();
