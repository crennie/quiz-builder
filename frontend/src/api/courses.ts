import {
    courseEnrollmentSchema,
    courseProgressSchema,
    enrolledCourseListResponseSchema,
    lessonProgressSchema,
    COURSE_CONTENT_MAX_BYTES,
    lessonQuizListResponseSchema,
    type SaveLessonBody,
    type LessonQuiz,
    courseSchema,
    courseListResponseSchema,
    lessonDetailSchema,
    lessonListResponseSchema,
    courseImportResultSchema,
    type CourseImportFile,
    type LessonImportFile,
} from "@quiz-builder/contracts";
import { apiRequest, authenticatedRequest } from "./client";

export async function listCourses(offset: number, archived = false) {
    return courseListResponseSchema.parse(
        await (archived ? authenticatedRequest : apiRequest)(
            `/v1/courses?limit=50&offset=${offset}&archived=${archived}`,
        ),
    );
}
export async function getCourse(id: string) {
    return courseSchema.parse(await apiRequest(`/v1/courses/${id}`));
}
export async function listCourseLessons(id: string, offset: number) {
    return lessonListResponseSchema.parse(
        await apiRequest(`/v1/courses/${id}/lessons?limit=50&offset=${offset}`),
    );
}
export async function getLesson(id: string) {
    return lessonDetailSchema.parse(await apiRequest(`/v1/lessons/${id}`));
}
export async function importCourse(importKey: string, content: CourseImportFile) {
    return courseImportResultSchema.parse(
        await authenticatedRequest("/v1/courses/import", {
            method: "POST",
            body: JSON.stringify({ importKey, content }),
        }),
    );
}
export async function importLessons(
    courseId: string,
    importKey: string,
    content: LessonImportFile,
) {
    return courseImportResultSchema.parse(
        await authenticatedRequest(`/v1/courses/${courseId}/lessons/import`, {
            method: "POST",
            body: JSON.stringify({ importKey, content }),
        }),
    );
}

export async function listLessonQuizzes(id: string): Promise<LessonQuiz[]> {
    const items: LessonQuiz[] = [];
    let offset: number | null = 0;
    while (offset !== null) {
        const page = lessonQuizListResponseSchema.parse(
            await apiRequest(`/v1/lessons/${id}/quizzes?limit=100&offset=${offset}`),
        );
        items.push(...page.items);
        offset = page.nextOffset;
    }
    return items;
}
export async function saveLesson(id: string, content: SaveLessonBody) {
    const body = JSON.stringify(content);
    if (new TextEncoder().encode(body).byteLength > COURSE_CONTENT_MAX_BYTES)
        throw new Error(
            "Lesson and quizzes exceed the 1 MiB save limit. Reduce the content before saving.",
        );
    return lessonDetailSchema.parse(
        await authenticatedRequest(`/v1/lessons/${id}`, {
            method: "PUT",
            body,
        }),
    );
}

export async function setCourseArchived(id: string, archived: boolean) {
    return courseSchema.parse(
        await authenticatedRequest(`/v1/courses/${id}/archive`, {
            method: "PUT",
            body: JSON.stringify({ archived }),
        }),
    );
}

export async function getCourseProgress(courseId: string) {
    return courseProgressSchema.parse(
        await authenticatedRequest(`/v1/courses/${courseId}/progress`),
    );
}
export async function enrollInCourse(courseId: string) {
    return courseEnrollmentSchema.parse(
        await authenticatedRequest(`/v1/courses/${courseId}/enrollment`, { method: "PUT" }),
    );
}
export async function listEnrolledCourses(offset: number) {
    return enrolledCourseListResponseSchema.parse(
        await authenticatedRequest(`/v1/me/courses?limit=50&offset=${offset}`),
    );
}
export async function setLessonProgress(lessonId: string, completed: boolean) {
    return lessonProgressSchema.parse(
        await authenticatedRequest(`/v1/lessons/${lessonId}/progress`, {
            method: "PUT",
            body: JSON.stringify({ completed }),
        }),
    );
}
