import {
    courseEnrollmentSchema,
    courseProgressSchema,
    enrolledCourseListResponseSchema,
    lessonProgressSchema,
    type Database,
} from "@quiz-builder/contracts";
import { AppError } from "../errors/app-error.ts";
import { assertCourseActive, getCourse, mapCourse } from "./courses.ts";
import { pool } from "./index.ts";
import type { QueryExecutor } from "./question-bank.ts";
import { withTransaction } from "./transaction.ts";

type EnrollmentRow = Database["public"]["Tables"]["course_enrollments"]["Row"];
type ProgressRow = Database["public"]["Tables"]["lesson_progress"]["Row"];
const iso = (value: string | Date) => new Date(value).toISOString();
const mapEnrollment = (row: EnrollmentRow) =>
    courseEnrollmentSchema.parse({ courseId: row.course_id, enrolledAt: iso(row.enrolled_at) });

export async function assertCourseEnrollment(
    courseId: string,
    userId: string,
    database: QueryExecutor,
) {
    const result = await database.query(
        "SELECT user_id FROM public.course_enrollments WHERE course_id=$1 AND user_id=$2 FOR KEY SHARE",
        [courseId, userId],
    );
    if (!result.rows.length)
        throw new AppError(
            403,
            "COURSE_ENROLLMENT_REQUIRED",
            "Enroll in this course to read lessons, track progress and take quizzes",
        );
}

export async function enrollInCourseInTransaction(
    courseId: string,
    userId: string,
    database: QueryExecutor,
) {
    await assertCourseActive(courseId, database);
    const result = await database.query<EnrollmentRow>(
        `INSERT INTO public.course_enrollments(user_id,course_id) VALUES($1,$2)
         ON CONFLICT(user_id,course_id) DO UPDATE SET enrolled_at=course_enrollments.enrolled_at
         RETURNING *`,
        [userId, courseId],
    );
    return mapEnrollment(result.rows[0]);
}
export function enrollInCourse(courseId: string, userId: string) {
    return withTransaction((db) => enrollInCourseInTransaction(courseId, userId, db));
}

export async function getCourseProgress(
    courseId: string,
    userId: string,
    database: QueryExecutor = pool,
) {
    await getCourse(courseId, database);
    const enrollment = await database.query<EnrollmentRow>(
        "SELECT * FROM public.course_enrollments WHERE course_id=$1 AND user_id=$2",
        [courseId, userId],
    );
    const progress = await database.query<ProgressRow>(
        "SELECT * FROM public.lesson_progress WHERE course_id=$1 AND user_id=$2 ORDER BY lesson_id",
        [courseId, userId],
    );
    return courseProgressSchema.parse({
        enrollment: enrollment.rows[0] ? mapEnrollment(enrollment.rows[0]) : null,
        completedLessons: progress.rows.map((row) => ({
            lessonId: row.lesson_id,
            completedAt: iso(row.completed_at),
        })),
    });
}

export async function listEnrolledCourses(
    userId: string,
    page: { limit: number; offset: number },
    database: QueryExecutor = pool,
) {
    type Row = Database["public"]["Tables"]["courses"]["Row"] & {
        enrolled_at: string;
        completed_lessons: number;
        total_lessons: number;
    };
    const result = await database.query<Row>(
        `SELECT c.*, e.enrolled_at,
         (SELECT count(*)::int FROM public.lessons l WHERE l.course_id=c.id) AS total_lessons,
         (SELECT count(*)::int FROM public.lesson_progress p WHERE p.course_id=c.id AND p.user_id=$1) AS completed_lessons
         FROM public.course_enrollments e JOIN public.courses c ON c.id=e.course_id
         WHERE e.user_id=$1 ORDER BY e.enrolled_at DESC,c.id LIMIT $2 OFFSET $3`,
        [userId, page.limit + 1, page.offset],
    );
    return enrolledCourseListResponseSchema.parse({
        items: result.rows.slice(0, page.limit).map((row) => ({
            course: mapCourse(row),
            enrolledAt: iso(row.enrolled_at),
            completedLessons: row.completed_lessons,
            totalLessons: row.total_lessons,
        })),
        nextOffset: result.rows.length > page.limit ? page.offset + page.limit : null,
    });
}

export async function setLessonProgressInTransaction(
    lessonId: string,
    userId: string,
    completed: boolean,
    database: QueryExecutor,
) {
    const lesson = await database.query<{ course_id: string }>(
        "SELECT course_id FROM public.lessons WHERE id=$1 FOR SHARE",
        [lessonId],
    );
    if (!lesson.rows[0]) throw new AppError(404, "LESSON_NOT_FOUND", "Lesson not found");
    const courseId = lesson.rows[0].course_id;
    await assertCourseActive(courseId, database);
    await assertCourseEnrollment(courseId, userId, database);
    if (!completed) {
        await database.query(
            "DELETE FROM public.lesson_progress WHERE user_id=$1 AND lesson_id=$2",
            [userId, lessonId],
        );
        return lessonProgressSchema.parse({ lessonId, completedAt: null });
    }
    const result = await database.query<ProgressRow>(
        `INSERT INTO public.lesson_progress(user_id,course_id,lesson_id) VALUES($1,$2,$3)
         ON CONFLICT(user_id,lesson_id) DO UPDATE SET completed_at=lesson_progress.completed_at RETURNING *`,
        [userId, courseId, lessonId],
    );
    return lessonProgressSchema.parse({ lessonId, completedAt: iso(result.rows[0].completed_at) });
}
export function setLessonProgress(lessonId: string, userId: string, completed: boolean) {
    return withTransaction((db) => setLessonProgressInTransaction(lessonId, userId, completed, db));
}
