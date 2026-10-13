import {
    courseSchema,
    courseListResponseSchema,
    lessonSchema,
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
    getLesson,
    listLessonQuizzes,
} from "../db/courses.ts";
import { optionalAuthentication } from "../middleware/authentication.ts";
export const courseRouter = Router();
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
    sendResponse(res, 200, lessonSchema, await getLesson(params.lessonId));
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
