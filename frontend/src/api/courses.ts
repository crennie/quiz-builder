import {
    courseSchema,
    courseListResponseSchema,
    lessonDetailSchema,
    lessonListResponseSchema,
    courseImportResultSchema,
    type CourseImportFile,
    type LessonImportFile,
} from "@quiz-builder/contracts";
import { apiRequest, authenticatedRequest } from "./client";

export async function listCourses(offset: number) {
    return courseListResponseSchema.parse(
        await apiRequest(`/v1/courses?limit=50&offset=${offset}`),
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
