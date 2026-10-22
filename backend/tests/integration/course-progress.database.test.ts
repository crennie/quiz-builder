import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDatabase, transaction, fixture, owner, other } from "./v1-fixtures.ts";
import {
    enrollInCourseInTransaction,
    getCourseProgress,
    listEnrolledCourses,
    setLessonProgressInTransaction,
} from "../../src/db/course-progress.ts";
import { getAttempt, startAttemptInTransaction } from "../../src/db/attempts.ts";
import { setCourseArchived } from "../../src/db/courses.ts";

describe("course enrollment and manual lesson progress", () => {
    let s: Awaited<ReturnType<typeof testDatabase>>;
    beforeAll(async () => {
        s = await testDatabase();
    });
    afterAll(async () => s.db.close());
    async function course() {
        const c = await s.sql.query<{ id: string }>(
            "INSERT INTO public.courses(title) VALUES('Learning') RETURNING id",
        );
        const id = c.rows[0].id;
        const l = await s.sql.query<{ id: string }>(
            "INSERT INTO public.lessons(course_id,title,position) VALUES($1,'First',0),($1,'Second',1) RETURNING id",
            [id],
        );
        return { id, lessonId: l.rows[0].id, secondId: l.rows[1].id };
    }
    const enroll = (courseId: string, userId = owner) =>
        transaction(s.db, () => enrollInCourseInTransaction(courseId, userId, s.sql));
    const complete = (lessonId: string, value = true, userId = owner) =>
        transaction(s.db, () => setLessonProgressInTransaction(lessonId, userId, value, s.sql));

    it("stores idempotent enrollment and manual completion independently for each user", async () => {
        const c = await course();
        expect(await getCourseProgress(c.id, owner, s.sql)).toEqual({
            enrollment: null,
            completedLessons: [],
        });
        await expect(complete(c.lessonId)).rejects.toMatchObject({
            statusCode: 403,
            code: "COURSE_ENROLLMENT_REQUIRED",
        });
        const enrollment = await enroll(c.id);
        expect(await enroll(c.id)).toEqual(enrollment);
        const progress = await complete(c.lessonId);
        expect(progress.completedAt).toBeTruthy();
        expect(await complete(c.lessonId)).toEqual(progress);
        expect((await getCourseProgress(c.id, owner, s.sql)).completedLessons).toEqual([progress]);
        expect(await getCourseProgress(c.id, other, s.sql)).toEqual({
            enrollment: null,
            completedLessons: [],
        });
        await enroll(c.id, other);
        await complete(c.lessonId, true, other);
        expect(await complete(c.lessonId, false)).toEqual({
            lessonId: c.lessonId,
            completedAt: null,
        });
        await complete(c.lessonId, false);
        expect((await getCourseProgress(c.id, owner, s.sql)).completedLessons).toEqual([]);
        expect((await getCourseProgress(c.id, other, s.sql)).completedLessons).toHaveLength(1);
    });

    it("enforces enrollment and same-course lesson relationships in SQL", async () => {
        const a = await course();
        const b = await course();
        await expect(
            s.sql.query(
                "INSERT INTO public.lesson_progress(user_id,course_id,lesson_id) VALUES($1,$2,$3)",
                [owner, a.id, a.lessonId],
            ),
        ).rejects.toMatchObject({ code: "23503" });
        await enroll(a.id);
        await expect(
            s.sql.query(
                "INSERT INTO public.lesson_progress(user_id,course_id,lesson_id) VALUES($1,$2,$3)",
                [owner, a.id, b.lessonId],
            ),
        ).rejects.toMatchObject({ code: "23503" });
        await expect(complete(b.lessonId)).rejects.toMatchObject({
            code: "COURSE_ENROLLMENT_REQUIRED",
        });
    });

    it("lists only my enrollments with accurate counts, pagination, and archived progress", async () => {
        const a = await course();
        const b = await course();
        const user = "00000000-0000-4000-8000-000000000103";
        await enroll(a.id, user);
        await enroll(b.id, user);
        await complete(a.lessonId, true, user);
        await setCourseArchived(a.id, true, s.sql);
        const first = await listEnrolledCourses(user, { limit: 1, offset: 0 }, s.sql);
        expect(first.nextOffset).toBe(1);
        const second = await listEnrolledCourses(user, { limit: 1, offset: 1 }, s.sql);
        expect(second.nextOffset).toBeNull();
        const archived = [...first.items, ...second.items].find((item) => item.course.id === a.id);
        expect(archived?.course.archivedAt).toBeTruthy();
        expect(archived).toMatchObject({
            totalLessons: 2,
            completedLessons: 1,
        });
        await expect(enroll(a.id)).rejects.toMatchObject({ code: "COURSE_ARCHIVED" });
        await expect(complete(a.secondId, true, user)).rejects.toMatchObject({
            code: "COURSE_ARCHIVED",
        });
        expect((await getCourseProgress(a.id, user, s.sql)).completedLessons).toHaveLength(1);
        await setCourseArchived(a.id, false, s.sql);
        await complete(a.secondId, true, user);
    });

    it("requires enrollment for course quiz starts and SQL inserts, while personal quizzes still work", async () => {
        const c = await course();
        const { quiz, question } = await transaction(s.db, () => fixture(s.sql));
        const oldAttempt = await transaction(s.db, () =>
            startAttemptInTransaction(quiz.id, owner, s.sql),
        );
        await s.sql.query("UPDATE public.questions SET visibility='public' WHERE id=$1", [
            question.id,
        ]);
        await s.sql.query("UPDATE public.quizzes SET visibility='public' WHERE id=$1", [quiz.id]);
        const association = await s.sql.query<{ id: string }>(
            "INSERT INTO public.lesson_quizzes(lesson_id,quiz_id,position) VALUES($1,$2,0) RETURNING id",
            [c.lessonId, quiz.id],
        );
        const context = association.rows[0].id;
        await expect(
            transaction(s.db, () => startAttemptInTransaction(quiz.id, owner, s.sql, context)),
        ).rejects.toMatchObject({ code: "COURSE_ENROLLMENT_REQUIRED" });
        await expect(
            transaction(s.db, () => startAttemptInTransaction(quiz.id, owner, s.sql)),
        ).rejects.toMatchObject({ code: "INVALID_LESSON_CONTEXT" });
        await expect(
            s.sql.query(
                "INSERT INTO public.quiz_attempts(quiz_id,user_id,quiz_title_snapshot,settings_snapshot) VALUES($1,$2,$3,$4::jsonb)",
                [quiz.id, owner, quiz.title, JSON.stringify(quiz.settings)],
            ),
        ).rejects.toThrow(/Enroll in this course/);
        expect((await getAttempt(oldAttempt.id, owner, s.sql)).id).toBe(oldAttempt.id);
        await enroll(c.id);
        const attempt = await transaction(s.db, () =>
            startAttemptInTransaction(quiz.id, owner, s.sql, context),
        );
        expect(attempt.lessonContext?.courseId).toBe(c.id);
        expect((await getCourseProgress(c.id, owner, s.sql)).completedLessons).toEqual([]);
        await expect(
            transaction(s.db, () => startAttemptInTransaction(quiz.id, other, s.sql, context)),
        ).rejects.toMatchObject({ code: "COURSE_ENROLLMENT_REQUIRED" });
        await setCourseArchived(c.id, true, s.sql);
        await expect(
            transaction(s.db, () => startAttemptInTransaction(quiz.id, owner, s.sql, context)),
        ).rejects.toMatchObject({ code: "COURSE_ARCHIVED" });
        expect((await getAttempt(attempt.id, owner, s.sql)).id).toBe(attempt.id);
    });

    it("returns not found for unknown courses and lessons", async () => {
        const missing = "00000000-0000-4000-8000-000000000999";
        await expect(enroll(missing)).rejects.toMatchObject({ code: "COURSE_NOT_FOUND" });
        await expect(complete(missing)).rejects.toMatchObject({ code: "LESSON_NOT_FOUND" });
    });
});
