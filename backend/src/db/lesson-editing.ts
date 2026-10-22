import { isDeepStrictEqual } from "node:util";
import { lessonQuizContentSchema, type SaveLessonBody } from "@quiz-builder/contracts";
import { AppError } from "../errors/app-error.ts";
import { assertCourseActive, getLessonDetail, listLessonQuizzes } from "./courses.ts";
import { withTransaction } from "./transaction.ts";
import { importLessonQuiz } from "./lesson-quiz-import.ts";

export function saveLesson(lessonId: string, userId: string, body: SaveLessonBody) {
    return withTransaction(async (db) => {
        await db.query("SELECT id FROM public.lessons WHERE id=$1 FOR UPDATE", [lessonId]);
        const lesson = await getLessonDetail(lessonId, db);
        await assertCourseActive(lesson.courseId, db);
        if (lesson.updatedAt !== body.expectedUpdatedAt)
            throw new AppError(
                409,
                "LESSON_CHANGED",
                "This lesson changed. Reload before editing again.",
            );
        // Match the attempt lock order: quiz before association. Serialize removal with starts.
        await db.query(
            `SELECT q.id FROM public.quizzes q JOIN public.lesson_quizzes lq ON lq.quiz_id=q.id
            WHERE lq.lesson_id=$1 ORDER BY q.id FOR UPDATE OF q`,
            [lessonId],
        );
        const current = await listLessonQuizzes(lessonId, userId, { limit: 10000, offset: 0 }, db);
        const existing = new Map(current.items.map((q) => [q.id, q]));
        for (const entry of body.quizzes) {
            if ("id" in entry && !existing.has(entry.id.toLowerCase()))
                throw new AppError(
                    400,
                    "INVALID_LESSON_QUIZ",
                    "Quiz does not belong to this lesson or has been removed",
                );
        }
        // Free positions first so swaps and removals are atomic without temporary positions.
        await db.query(
            "UPDATE public.lesson_quizzes SET removed_at=now() WHERE lesson_id=$1 AND removed_at IS NULL",
            [lessonId],
        );
        for (const [position, entry] of body.quizzes.entries()) {
            const old = "id" in entry ? existing.get(entry.id.toLowerCase()) : undefined;
            const content = "import" in entry ? entry.import : entry.content;
            const oldContent = old
                ? lessonQuizContentSchema.parse({
                      title: old.quiz.title,
                      description: old.quiz.description,
                      settings: old.quiz.settings,
                      questions: old.quiz.questions.map((q) => ({
                          content: q.question,
                          points: q.points,
                          required: q.required,
                          timeLimitSeconds: q.timeLimitSeconds,
                      })),
                  })
                : null;
            if (old && isDeepStrictEqual(content, oldContent)) {
                await db.query(
                    "UPDATE public.lesson_quizzes SET removed_at=NULL,position=$2 WHERE id=$1",
                    [old.id, position],
                );
            } else {
                // Replacement preserves locked sources and all historical attempts.
                const quizId = await importLessonQuiz(db, userId, content);
                await db.query(
                    "INSERT INTO public.lesson_quizzes(lesson_id,quiz_id,position) VALUES($1,$2,$3)",
                    [lessonId, quizId, position],
                );
            }
        }
        await db.query(
            `UPDATE public.lessons SET title=$2,description=$3,content=$4,
            updated_at=GREATEST(clock_timestamp(),updated_at + interval '1 millisecond') WHERE id=$1`,
            [lessonId, body.title, body.description, body.content],
        );
        return getLessonDetail(lessonId, db);
    });
}
