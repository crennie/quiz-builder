import {
    courseSchema,
    lessonSchema,
    lessonDetailSchema,
    lessonQuizSchema,
    type Database,
} from "@quiz-builder/contracts";
import { AppError } from "../errors/app-error.ts";
import { pool } from "./index.ts";
import type { QueryExecutor } from "./question-bank.ts";
import { getQuizDetail } from "./quizzes.ts";
type CourseRow = Database["public"]["Tables"]["courses"]["Row"];
type LessonRow = Database["public"]["Tables"]["lessons"]["Row"];
type Page = { limit: number; offset: number };
const iso = (value: string | Date) => new Date(value).toISOString();
const mapCourse = (r: CourseRow) =>
    courseSchema.parse({
        id: r.id,
        title: r.title,
        description: r.description,
        createdAt: iso(r.created_at),
        updatedAt: iso(r.updated_at),
    });
const mapLesson = (r: LessonRow) =>
    lessonSchema.parse({
        ...mapCourse(r),
        courseId: r.course_id,
        content: r.content,
        position: r.position,
    });
export async function listCourses(page: Page, database: QueryExecutor = pool) {
    const r = await database.query<CourseRow>(
        `SELECT * FROM public.courses ORDER BY title,id LIMIT $1 OFFSET $2`,
        [page.limit + 1, page.offset],
    );
    return {
        items: r.rows.slice(0, page.limit).map(mapCourse),
        nextOffset: r.rows.length > page.limit ? page.offset + page.limit : null,
    };
}
export async function getCourse(courseId: string, database: QueryExecutor = pool) {
    const r = await database.query<CourseRow>(`SELECT * FROM public.courses WHERE id=$1`, [
        courseId,
    ]);
    if (!r.rows[0]) throw new AppError(404, "COURSE_NOT_FOUND", "Course not found");
    return mapCourse(r.rows[0]);
}
export async function listCourseLessons(
    courseId: string,
    page: Page,
    database: QueryExecutor = pool,
) {
    await getCourse(courseId, database);
    const r = await database.query<LessonRow>(
        `SELECT * FROM public.lessons WHERE course_id=$1 ORDER BY position,id LIMIT $2 OFFSET $3`,
        [courseId, page.limit + 1, page.offset],
    );
    return {
        items: r.rows.slice(0, page.limit).map(mapLesson),
        nextOffset: r.rows.length > page.limit ? page.offset + page.limit : null,
    };
}
export async function getLesson(lessonId: string, database: QueryExecutor = pool) {
    const r = await database.query<LessonRow>(`SELECT * FROM public.lessons WHERE id=$1`, [
        lessonId,
    ]);
    if (!r.rows[0]) throw new AppError(404, "LESSON_NOT_FOUND", "Lesson not found");
    return mapLesson(r.rows[0]);
}
export async function listLessonQuizzes(
    lessonId: string,
    viewerId: string | null,
    page: Page,
    database: QueryExecutor = pool,
) {
    await getLesson(lessonId, database);
    const r = await database.query<{
        id: string;
        lesson_id: string;
        quiz_id: string;
        position: number;
    }>(
        `SELECT * FROM public.lesson_quizzes WHERE lesson_id=$1 AND removed_at IS NULL ORDER BY position,quiz_id LIMIT $2 OFFSET $3`,
        [lessonId, page.limit + 1, page.offset],
    );
    const items = [];
    for (const row of r.rows.slice(0, page.limit)) {
        const quiz = await getQuizDetail(row.quiz_id, viewerId, database);
        if (!quiz) throw new Error("Lesson quiz is not public");
        items.push(
            lessonQuizSchema.parse({
                id: row.id,
                lessonId: row.lesson_id,
                quizId: row.quiz_id,
                position: row.position,
                quiz,
            }),
        );
    }
    return { items, nextOffset: r.rows.length > page.limit ? page.offset + page.limit : null };
}

export async function getLessonDetail(lessonId: string, database: QueryExecutor = pool) {
    const lesson = await getLesson(lessonId, database);
    const previous = await database.query<{ id: string; title: string }>(
        `SELECT id,title FROM public.lessons WHERE course_id=$1 AND position<$2 ORDER BY position DESC LIMIT 1`,
        [lesson.courseId, lesson.position],
    );
    const next = await database.query<{ id: string; title: string }>(
        `SELECT id,title FROM public.lessons WHERE course_id=$1 AND position>$2 ORDER BY position LIMIT 1`,
        [lesson.courseId, lesson.position],
    );
    return lessonDetailSchema.parse({
        ...lesson,
        previousLesson: previous.rows[0] ?? null,
        nextLesson: next.rows[0] ?? null,
    });
}
