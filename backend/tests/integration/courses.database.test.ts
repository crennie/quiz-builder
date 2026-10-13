import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDatabase, transaction, fixture, owner } from "./v1-fixtures.ts";
import {
    getCourse,
    listCourses,
    getLesson,
    listCourseLessons,
    listLessonQuizzes,
} from "../../src/db/courses.ts";
describe("public course hierarchy", () => {
    let s: Awaited<ReturnType<typeof testDatabase>>;
    beforeAll(async () => {
        s = await testDatabase();
    });
    afterAll(async () => s.db.close());
    it("enforces course ownership of ordered lessons, movement, reuse, and public quiz associations", async () => {
        const { db, sql } = s;
        const courses = await sql.query<{ id: string }>(
            "INSERT INTO public.courses(title) VALUES('A'),('B') RETURNING id",
        );
        const [a, b] = courses.rows.map((r) => r.id);
        await expect(
            sql.query("INSERT INTO public.lessons(title,position) VALUES('Missing course',0)"),
        ).rejects.toMatchObject({ code: "23502" });
        const lessons = await sql.query<{ id: string }>(
            "INSERT INTO public.lessons(course_id,title,content,position) VALUES($1,'First','Markdown',0),($1,'Second','',1) RETURNING id",
            [a],
        );
        const [first, second] = lessons.rows.map((r) => r.id);
        await expect(
            sql.query(
                "INSERT INTO public.lessons(course_id,title,position) VALUES($1,'Collision',0)",
                [a],
            ),
        ).rejects.toMatchObject({ code: "23505" });
        await sql.query("UPDATE public.lessons SET course_id=$2,position=0 WHERE id=$1", [
            second,
            b,
        ]);
        const { quiz, question } = await transaction(db, () => fixture(sql));
        await expect(
            sql.query(
                "INSERT INTO public.lesson_quizzes(lesson_id,quiz_id,position) VALUES($1,$2,0)",
                [first, quiz.id],
            ),
        ).rejects.toMatchObject({ code: "23514" });
        await sql.query("UPDATE public.questions SET visibility='public' WHERE id=$1", [
            question.id,
        ]);
        await sql.query("UPDATE public.quizzes SET visibility='public' WHERE id=$1", [quiz.id]);
        await sql.query(
            "INSERT INTO public.lesson_quizzes(lesson_id,quiz_id,position) VALUES($1,$3,0),($2,$3,0)",
            [first, second, quiz.id],
        );
        const another = await transaction(db, () => fixture(sql));
        await sql.query("UPDATE public.questions SET visibility='public' WHERE id=$1", [
            another.question.id,
        ]);
        await sql.query("UPDATE public.quizzes SET visibility='public' WHERE id=$1", [
            another.quiz.id,
        ]);
        await expect(
            sql.query(
                "INSERT INTO public.lesson_quizzes(lesson_id,quiz_id,position) VALUES($1,$2,0)",
                [first, another.quiz.id],
            ),
        ).rejects.toMatchObject({ code: "23505" });
        await expect(
            sql.query("UPDATE public.quizzes SET visibility='private' WHERE id=$1", [quiz.id]),
        ).rejects.toMatchObject({ code: "23514" });
        await expect(
            sql.query("UPDATE public.questions SET visibility='private' WHERE id=$1", [
                question.id,
            ]),
        ).rejects.toMatchObject({ code: "23514" });
        expect((await listCourses({ limit: 1, offset: 0 }, sql)).nextOffset).toBe(1);
        expect(await getCourse(a, sql)).toMatchObject({ title: "A" });
        expect(await getLesson(second, sql)).toMatchObject({ courseId: b, position: 0 });
        expect(
            (await listCourseLessons(a, { limit: 50, offset: 0 }, sql)).items.map((l) => l.id),
        ).toEqual([first]);
        expect(
            (await listLessonQuizzes(second, null, { limit: 50, offset: 0 }, sql)).items[0],
        ).toMatchObject({ quizId: quiz.id, position: 0, quiz: { isOwner: false } });
        expect(
            (await listLessonQuizzes(first, owner, { limit: 50, offset: 0 }, sql)).items[0].quiz
                .isOwner,
        ).toBe(true);
    });
});
