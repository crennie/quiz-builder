import { createHash } from "node:crypto";
import type {
    CourseImportFile,
    CourseImportResult,
    LessonImportFile,
} from "@quiz-builder/contracts";
import { AppError } from "../errors/app-error.ts";
import { withTransaction } from "./transaction.ts";

export function importCourseContent(
    sponsorId: string,
    importKey: string,
    content: CourseImportFile | LessonImportFile,
    courseId: string | null = null,
): Promise<CourseImportResult> {
    courseId = courseId?.toLowerCase() ?? null;
    // The parsed schemas give fields a stable order and normalize defaults before hashing.
    const digest = createHash("sha256").update(JSON.stringify({ courseId, content })).digest("hex");
    return withTransaction(async (db) => {
        // Serialize retries before creating any content, including concurrent first requests.
        await db.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
            `course-import:${sponsorId.toLowerCase()}:${importKey.toLowerCase()}`,
        ]);
        const previous = await db.query<{
            artifact_sha256: string;
            course_id: string;
            lesson_ids: string[];
        }>(
            "SELECT artifact_sha256,course_id,lesson_ids FROM public.course_imports WHERE sponsor_id=$1 AND import_key=$2",
            [sponsorId, importKey],
        );
        if (previous.rows[0]) {
            const row = previous.rows[0];
            if (row.artifact_sha256 !== digest)
                throw new AppError(
                    409,
                    "IMPORT_KEY_CONFLICT",
                    "This import key was already used for different content",
                );
            return { courseId: row.course_id, lessonIds: row.lesson_ids };
        }
        let targetId = courseId;
        if (targetId) {
            const course = await db.query("SELECT id FROM public.courses WHERE id=$1 FOR UPDATE", [
                targetId,
            ]);
            if (!course.rows[0]) throw new AppError(404, "COURSE_NOT_FOUND", "Course not found");
        } else {
            if (!("title" in content)) throw new Error("Course title is required");
            const course = await db.query<{ id: string }>(
                "INSERT INTO public.courses(title,description) VALUES($1,$2) RETURNING id",
                [content.title, content.description],
            );
            targetId = course.rows[0].id;
        }
        const positions = await db.query<{ next_position: number }>(
            "SELECT COALESCE(MAX(position)+1,0) AS next_position FROM public.lessons WHERE course_id=$1",
            [targetId],
        );
        const lessonIds: string[] = [];
        for (const [index, lesson] of content.lessons.entries()) {
            const result = await db.query<{ id: string }>(
                `INSERT INTO public.lessons(course_id,title,description,content,position)
                 VALUES($1,$2,$3,$4,$5) RETURNING id`,
                [
                    targetId,
                    lesson.title,
                    lesson.description,
                    lesson.content,
                    positions.rows[0].next_position + index,
                ],
            );
            lessonIds.push(result.rows[0].id);
        }
        await db.query(
            `INSERT INTO public.course_imports(sponsor_id,import_key,artifact_sha256,course_id,lesson_ids)
             VALUES($1,$2,$3,$4,$5)`,
            [sponsorId, importKey, digest, targetId, lessonIds],
        );
        return { courseId: targetId, lessonIds };
    });
}
