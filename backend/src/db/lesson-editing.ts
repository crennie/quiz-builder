import { isDeepStrictEqual } from "node:util";
import {
    lessonQuizContentSchema,
    type LessonQuizContent,
    type SaveLessonBody,
} from "@quiz-builder/contracts";
import { AppError } from "../errors/app-error.ts";
import { getLessonDetail, listLessonQuizzes } from "./courses.ts";
import { withTransaction } from "./transaction.ts";
import type { QueryExecutor } from "./question-bank.ts";

async function importQuiz(db: QueryExecutor, userId: string, content: LessonQuizContent) {
    const result = await db.query<{ id: string }>(
        `INSERT INTO public.quizzes(created_by,visibility,title,description,settings)
         VALUES($1,'public',$2,$3,$4::jsonb) RETURNING id`,
        [userId, content.title, content.description, JSON.stringify(content.settings)],
    );
    const quizId = result.rows[0].id;
    for (const [position, member] of content.questions.entries()) {
        const q = member.content;
        const question = await db.query<{ id: string }>(
            `INSERT INTO public.questions(created_by,visibility,prompt,question_type,answer_config,grading_config,explanation)
             VALUES($1,'public',$2,$3,$4::jsonb,$5::jsonb,$6) RETURNING id`,
            [
                userId,
                q.prompt,
                q.questionType,
                JSON.stringify(q.answerConfig),
                JSON.stringify(q.gradingConfig),
                q.explanation,
            ],
        );
        await db.query(
            `INSERT INTO public.quiz_questions(quiz_id,question_id,position,points,required,time_limit_seconds)
             VALUES($1,$2,$3,$4,$5,$6)`,
            [
                quizId,
                question.rows[0].id,
                position,
                member.points,
                member.required,
                member.timeLimitSeconds,
            ],
        );
    }
    return quizId;
}

export function saveLesson(lessonId: string, userId: string, body: SaveLessonBody) {
    return withTransaction(async (db) => {
        await db.query("SELECT id FROM public.lessons WHERE id=$1 FOR UPDATE", [lessonId]);
        const lesson = await getLessonDetail(lessonId, db);
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
                const quizId = await importQuiz(db, userId, content);
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
