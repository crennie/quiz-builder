-- Keep retired associations for immutable attempt context, but hide them from the lesson.
ALTER TABLE public.lesson_quizzes ADD COLUMN removed_at timestamptz;
-- Existing shared quizzes must be resolved before applying this constraint.
ALTER TABLE public.lesson_quizzes ADD CONSTRAINT lesson_quizzes_single_lesson UNIQUE (quiz_id);
ALTER TABLE public.lesson_quizzes DROP CONSTRAINT lesson_quizzes_lesson_id_position_key;
CREATE UNIQUE INDEX lesson_quizzes_active_position ON public.lesson_quizzes(lesson_id, position)
    WHERE removed_at IS NULL;

CREATE OR REPLACE FUNCTION public.guard_attempt_lesson_context() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        IF NEW.lesson_quiz_id IS DISTINCT FROM OLD.lesson_quiz_id THEN
            RAISE EXCEPTION 'Attempt lesson context is immutable' USING ERRCODE = '23514';
        END IF;
    ELSE
        PERFORM id FROM public.quizzes WHERE id = NEW.quiz_id FOR UPDATE;
        IF EXISTS (SELECT 1 FROM public.lesson_quizzes WHERE quiz_id = NEW.quiz_id)
            AND NOT EXISTS (SELECT 1 FROM public.lesson_quizzes
                WHERE id = NEW.lesson_quiz_id AND quiz_id = NEW.quiz_id AND removed_at IS NULL) THEN
            RAISE EXCEPTION 'Lesson quizzes require active lesson context' USING ERRCODE = '23514';
        END IF;
        IF NEW.lesson_quiz_id IS NOT NULL THEN
            PERFORM id FROM public.lesson_quizzes
                WHERE id = NEW.lesson_quiz_id AND quiz_id = NEW.quiz_id AND removed_at IS NULL FOR KEY SHARE;
            IF NOT FOUND THEN
                RAISE EXCEPTION 'Lesson context must reference the active attempted quiz' USING ERRCODE = '23514';
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END; $$;
