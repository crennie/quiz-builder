-- Preserve course content and attempt history while hiding archived courses from active lists.
ALTER TABLE public.courses ADD COLUMN archived_at timestamptz;
CREATE INDEX courses_archive_title_idx ON public.courses (archived_at, title, id);

CREATE FUNCTION public.reject_archived_course_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    course_archived_at timestamptz;
BEGIN
    SELECT c.archived_at INTO course_archived_at
    FROM public.courses c
    JOIN public.lessons l ON l.course_id=c.id
    JOIN public.lesson_quizzes lq ON lq.lesson_id=l.id
    WHERE lq.quiz_id=NEW.quiz_id
    FOR SHARE OF c;
    IF course_archived_at IS NOT NULL THEN
        RAISE EXCEPTION 'Archived courses cannot start new attempts' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER quiz_attempts_course_archive_guard BEFORE INSERT ON public.quiz_attempts
    FOR EACH ROW EXECUTE FUNCTION public.reject_archived_course_attempt();
