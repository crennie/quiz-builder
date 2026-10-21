import {
    saveLessonBodySchema,
    courseSchema,
    courseImportBodySchema,
    lessonImportBodySchema,
    courseImportResultSchema,
    courseListResponseSchema,
    lessonDetailSchema,
    lessonListResponseSchema,
    lessonQuizListResponseSchema,
} from "@quiz-builder/contracts";
import { Router } from "express";
import { validateRequest } from "../api/request.ts";
import { sendResponse } from "../api/response.ts";
import {
    courseParamsSchema,
    lessonParamsSchema,
    contentListQuerySchema,
} from "../api/schemas/courses.ts";
import {
    listCourses,
    getCourse,
    listCourseLessons,
    getLessonDetail,
    listLessonQuizzes,
} from "../db/courses.ts";
import { importCourseContent } from "../db/course-imports.ts";
import { requireAuthentication, optionalAuthentication } from "../middleware/authentication.ts";
import { saveLesson } from "../db/lesson-editing.ts";
export const courseRouter = Router();
// Writes authenticate before public read middleware to avoid verifying tokens twice.
courseRouter.post("/courses/import", requireAuthentication, async (req, res) => {
    const { body } = validateRequest(req, { body: courseImportBodySchema });
    const userId = req.authenticatedUser?.id;
    if (!userId) throw new Error("Authenticated user is missing");
    sendResponse(
        res,
        201,
        courseImportResultSchema,
        await importCourseContent(userId, body.importKey, body.content),
    );
});
courseRouter.post("/courses/:courseId/lessons/import", requireAuthentication, async (req, res) => {
    const { params, body } = validateRequest(req, {
        params: courseParamsSchema,
        body: lessonImportBodySchema,
    });
    const userId = req.authenticatedUser?.id;
    if (!userId) throw new Error("Authenticated user is missing");
    sendResponse(
        res,
        201,
        courseImportResultSchema,
        await importCourseContent(userId, body.importKey, body.content, params.courseId),
    );
});
courseRouter.put("/lessons/:lessonId", requireAuthentication, async (req, res) => {
    const { params, body } = validateRequest(req, {
        params: lessonParamsSchema,
        body: saveLessonBodySchema,
    });
    const userId = req.authenticatedUser?.id;
    if (!userId) throw new Error("Authenticated user is missing");
    sendResponse(res, 200, lessonDetailSchema, await saveLesson(params.lessonId, userId, body));
});
courseRouter.use(["/courses", "/lessons"], optionalAuthentication);
courseRouter.get("/courses", async (req, res) => {
    const { query } = validateRequest(req, { query: contentListQuerySchema });
    sendResponse(res, 200, courseListResponseSchema, await listCourses(query));
});
courseRouter.get("/courses/:courseId", async (req, res) => {
    const { params } = validateRequest(req, { params: courseParamsSchema });
    sendResponse(res, 200, courseSchema, await getCourse(params.courseId));
});
courseRouter.get("/courses/:courseId/lessons", async (req, res) => {
    const { params, query } = validateRequest(req, {
        params: courseParamsSchema,
        query: contentListQuerySchema,
    });
    sendResponse(
        res,
        200,
        lessonListResponseSchema,
        await listCourseLessons(params.courseId, query),
    );
});
courseRouter.get("/lessons/:lessonId", async (req, res) => {
    const { params } = validateRequest(req, { params: lessonParamsSchema });
    sendResponse(res, 200, lessonDetailSchema, await getLessonDetail(params.lessonId));
});
courseRouter.get("/lessons/:lessonId/quizzes", async (req, res) => {
    const { params, query } = validateRequest(req, {
        params: lessonParamsSchema,
        query: contentListQuerySchema,
    });
    sendResponse(
        res,
        200,
        lessonQuizListResponseSchema,
        await listLessonQuizzes(params.lessonId, req.authenticatedUser?.id ?? null, query),
    );
});
