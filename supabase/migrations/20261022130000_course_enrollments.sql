CREATE TABLE public.course_enrollments (
    user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
    course_id uuid NOT NULL REFERENCES public.courses(id) ON DELETE RESTRICT,
    enrolled_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, course_id)
);
CREATE INDEX course_enrollments_course_idx ON public.course_enrollments(course_id);
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;

-- A completion belongs to both an enrollment and a lesson in that same course.
ALTER TABLE public.lessons ADD CONSTRAINT lessons_id_course_unique UNIQUE (id, course_id);
CREATE TABLE public.lesson_progress (
    user_id uuid NOT NULL,
    course_id uuid NOT NULL,
    lesson_id uuid NOT NULL,
    completed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, lesson_id),
    FOREIGN KEY (user_id, course_id) REFERENCES public.course_enrollments(user_id, course_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    FOREIGN KEY (lesson_id, course_id) REFERENCES public.lessons(id, course_id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
);
CREATE INDEX lesson_progress_course_idx ON public.lesson_progress(user_id, course_id);
CREATE INDEX lesson_progress_lesson_idx ON public.lesson_progress(lesson_id, course_id);
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

-- Check the quiz's actual association, so omitting lesson context cannot bypass enrollment.
-- Existing attempts remain readable and resumable; only new attempts are gated.
CREATE FUNCTION public.require_course_enrollment_for_attempt() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    required_course_id uuid;
BEGIN
    SELECT l.course_id INTO required_course_id FROM public.lesson_quizzes lq
    JOIN public.lessons l ON l.id=lq.lesson_id WHERE lq.quiz_id=NEW.quiz_id;
    IF required_course_id IS NOT NULL THEN
        PERFORM user_id FROM public.course_enrollments
            WHERE user_id=NEW.user_id AND course_id=required_course_id FOR KEY SHARE;
        IF NOT FOUND THEN
            RAISE EXCEPTION 'Enroll in this course before starting a quiz' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER quiz_attempts_enrollment_guard BEFORE INSERT ON public.quiz_attempts
    FOR EACH ROW EXECUTE FUNCTION public.require_course_enrollment_for_attempt();
