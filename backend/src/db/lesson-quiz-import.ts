import type { LessonQuizContent } from "@quiz-builder/contracts";
import type { QueryExecutor } from "./question-bank.ts";

export async function importLessonQuiz(
    db: QueryExecutor,
    userId: string,
    content: LessonQuizContent,
) {
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
