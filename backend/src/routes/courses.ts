import {
    courseEnrollmentSchema,
    courseProgressSchema,
    enrolledCourseListResponseSchema,
    lessonProgressSchema,
    setLessonProgressBodySchema,
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
import { requirePlatformAdmin } from "../middleware/platform-admin.ts";
import { pool } from "../db/index.ts";
import { Router } from "express";
import { validateRequest } from "../api/request.ts";
import { sendResponse } from "../api/response.ts";
import {
    courseListQuerySchema,
    courseArchiveBodySchema,
    courseParamsSchema,
    lessonParamsSchema,
    contentListQuerySchema,
} from "../api/schemas/courses.ts";
import {
    setCourseArchived,
    listCourses,
    getCourse,
    listCourseLessons,
    getLessonDetail,
    getLesson,
    listLessonQuizzes,
} from "../db/courses.ts";
import { importCourseContent } from "../db/course-imports.ts";
import { requireAuthentication, optionalAuthentication } from "../middleware/authentication.ts";
import { AppError } from "../errors/app-error.ts";
import { saveLesson } from "../db/lesson-editing.ts";
import {
    assertCourseEnrollment,
    enrollInCourse,
    getCourseProgress,
    listEnrolledCourses,
    setLessonProgress,
} from "../db/course-progress.ts";
export const courseRouter = Router();
courseRouter.get("/me/courses", requireAuthentication, async (req, res) => {
    const { query } = validateRequest(req, { query: contentListQuerySchema });
    const userId = req.authenticatedUser?.id;
    if (!userId) throw new Error("Authenticated user is missing");
    sendResponse(
        res,
        200,
        enrolledCourseListResponseSchema,
        await listEnrolledCourses(userId, query),
    );
});
courseRouter.get("/courses/:courseId/progress", requireAuthentication, async (req, res) => {
    const { params } = validateRequest(req, { params: courseParamsSchema });
    const userId = req.authenticatedUser?.id;
    if (!userId) throw new Error("Authenticated user is missing");
    sendResponse(res, 200, courseProgressSchema, await getCourseProgress(params.courseId, userId));
});
courseRouter.put("/courses/:courseId/enrollment", requireAuthentication, async (req, res) => {
    const { params } = validateRequest(req, { params: courseParamsSchema });
    const userId = req.authenticatedUser?.id;
    if (!userId) throw new Error("Authenticated user is missing");
    sendResponse(res, 200, courseEnrollmentSchema, await enrollInCourse(params.courseId, userId));
});
courseRouter.put("/lessons/:lessonId/progress", requireAuthentication, async (req, res) => {
    const { params, body } = validateRequest(req, {
        params: lessonParamsSchema,
        body: setLessonProgressBodySchema,
    });
    const userId = req.authenticatedUser?.id;
    if (!userId) throw new Error("Authenticated user is missing");
    sendResponse(
        res,
        200,
        lessonProgressSchema,
        await setLessonProgress(params.lessonId, userId, body.completed),
    );
});

// Writes authenticate before public read middleware to avoid verifying tokens twice.
courseRouter.post(
    "/courses/import",
    requireAuthentication,
    requirePlatformAdmin,
    async (req, res) => {
        const { body } = validateRequest(req, { body: courseImportBodySchema });
        const userId = req.authenticatedUser?.id;
        if (!userId) throw new Error("Authenticated user is missing");
        sendResponse(
            res,
            201,
            courseImportResultSchema,
            await importCourseContent(userId, body.importKey, body.content),
        );
    },
);
courseRouter.post(
    "/courses/:courseId/lessons/import",
    requireAuthentication,
    requirePlatformAdmin,
    async (req, res) => {
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
    },
);
courseRouter.put(
    "/lessons/:lessonId",
    requireAuthentication,
    requirePlatformAdmin,
    async (req, res) => {
        const { params, body } = validateRequest(req, {
            params: lessonParamsSchema,
            body: saveLessonBodySchema,
        });
        const userId = req.authenticatedUser?.id;
        if (!userId) throw new Error("Authenticated user is missing");
        sendResponse(res, 200, lessonDetailSchema, await saveLesson(params.lessonId, userId, body));
    },
);
courseRouter.put(
    "/courses/:courseId/archive",
    requireAuthentication,
    requirePlatformAdmin,
    async (req, res) => {
        const { params, body } = validateRequest(req, {
            params: courseParamsSchema,
            body: courseArchiveBodySchema,
        });
        sendResponse(
            res,
            200,
            courseSchema,
            await setCourseArchived(params.courseId, body.archived),
        );
    },
);
courseRouter.use(["/courses", "/lessons"], optionalAuthentication);
courseRouter.get("/courses", async (req, res) => {
    const { query } = validateRequest(req, { query: courseListQuerySchema });
    if (query.archived && !req.authenticatedUser)
        throw new AppError(401, "UNAUTHORIZED", "A valid access token is required");
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
    await assertLessonReadAccess(params.lessonId, req.currentProfile);
    sendResponse(res, 200, lessonDetailSchema, await getLessonDetail(params.lessonId));
});
courseRouter.get("/lessons/:lessonId/quizzes", async (req, res) => {
    const { params, query } = validateRequest(req, {
        params: lessonParamsSchema,
        query: contentListQuerySchema,
    });
    await assertLessonReadAccess(params.lessonId, req.currentProfile);
    sendResponse(
        res,
        200,
        lessonQuizListResponseSchema,
        await listLessonQuizzes(params.lessonId, req.authenticatedUser?.id ?? null, query),
    );
});

async function assertLessonReadAccess(
    lessonId: string,
    profile: { id: string; isPlatformAdmin: boolean } | undefined,
) {
    if (profile?.isPlatformAdmin) return;
    if (!profile) throw new AppError(401, "UNAUTHORIZED", "Sign in and enroll to read this lesson");
    const lesson = await getLesson(lessonId);
    await assertCourseEnrollment(lesson.courseId, profile.id, pool);
}
