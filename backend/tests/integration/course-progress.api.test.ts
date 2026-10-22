import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
import { verifyAccessToken } from "../../src/auth/supabase.ts";
import { getOrCreateProfile } from "../../src/db/profiles.ts";
import {
    enrollInCourse,
    getCourseProgress,
    listEnrolledCourses,
    setLessonProgress,
} from "../../src/db/course-progress.ts";
import { AppError } from "../../src/errors/app-error.ts";
vi.mock("../../src/auth/supabase.ts", () => ({ verifyAccessToken: vi.fn() }));
vi.mock("../../src/db/profiles.ts", () => ({ getOrCreateProfile: vi.fn() }));
vi.mock("../../src/db/course-progress.ts", () => ({
    enrollInCourse: vi.fn(),
    getCourseProgress: vi.fn(),
    listEnrolledCourses: vi.fn(),
    setLessonProgress: vi.fn(),
}));
import { app } from "../../src/app.ts";

const userId = "00000000-0000-4000-8000-000000000101";
const courseId = "00000000-0000-4000-8000-000000000201";
const lessonId = "00000000-0000-4000-8000-000000000301";
const timestamp = "2026-10-22T00:00:00.000Z";
const auth = { Authorization: "Bearer verified-token" };
beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(verifyAccessToken).mockResolvedValue({ id: userId, userMetadata: {} });
    vi.mocked(getOrCreateProfile).mockResolvedValue({
        id: userId,
        displayName: "Learner",
        avatarUrl: null,
        createdAt: new Date(timestamp),
        updatedAt: new Date(timestamp),
    });
});
it("requires verified authentication for every enrollment and progress endpoint", async () => {
    expect((await request(app).get("/api/v1/me/courses")).status).toBe(401);
    expect((await request(app).get(`/api/v1/courses/${courseId}/progress`)).status).toBe(401);
    expect((await request(app).put(`/api/v1/courses/${courseId}/enrollment`)).status).toBe(401);
    expect(
        (await request(app).put(`/api/v1/lessons/${lessonId}/progress`).send({ completed: true }))
            .status,
    ).toBe(401);
    vi.mocked(verifyAccessToken).mockRejectedValue(
        new AppError(401, "UNAUTHORIZED", "Invalid token"),
    );
    expect((await request(app).get("/api/v1/me/courses").set(auth)).status).toBe(401);
    expect(listEnrolledCourses).not.toHaveBeenCalled();
    expect(enrollInCourse).not.toHaveBeenCalled();
    expect(setLessonProgress).not.toHaveBeenCalled();
});
it("uses the verified identity and validates pagination, lesson IDs, and completion bodies", async () => {
    vi.mocked(enrollInCourse).mockResolvedValue({ courseId, enrolledAt: timestamp });
    expect(
        (
            await request(app)
                .put(`/api/v1/courses/${courseId}/enrollment`)
                .set(auth)
                .send({ userId: courseId })
        ).status,
    ).toBe(200);
    expect(enrollInCourse).toHaveBeenCalledWith(courseId, userId);
    vi.mocked(getCourseProgress).mockResolvedValue({ enrollment: null, completedLessons: [] });
    expect((await request(app).get(`/api/v1/courses/${courseId}/progress`).set(auth)).body).toEqual(
        { enrollment: null, completedLessons: [] },
    );
    expect(getCourseProgress).toHaveBeenCalledWith(courseId, userId);
    vi.mocked(listEnrolledCourses).mockResolvedValue({ items: [], nextOffset: null });
    expect((await request(app).get("/api/v1/me/courses?limit=1&offset=2").set(auth)).status).toBe(
        200,
    );
    expect(listEnrolledCourses).toHaveBeenCalledWith(userId, { limit: 1, offset: 2 });
    expect((await request(app).get("/api/v1/me/courses?limit=101").set(auth)).status).toBe(400);
    for (const body of [{ completed: "true" }, {}, { completed: true, userId: courseId }]) {
        expect(
            (await request(app).put(`/api/v1/lessons/${lessonId}/progress`).set(auth).send(body))
                .status,
        ).toBe(400);
    }
    expect(
        (
            await request(app)
                .put("/api/v1/lessons/not-a-uuid/progress")
                .set(auth)
                .send({ completed: true })
        ).status,
    ).toBe(400);
    expect(setLessonProgress).not.toHaveBeenCalled();
    vi.mocked(setLessonProgress).mockResolvedValue({ lessonId, completedAt: timestamp });
    expect(
        (
            await request(app)
                .put(`/api/v1/lessons/${lessonId}/progress`)
                .set(auth)
                .send({ completed: true })
        ).body,
    ).toEqual({ lessonId, completedAt: timestamp });
    expect(setLessonProgress).toHaveBeenCalledWith(lessonId, userId, true);
});
it("returns the enrollment error without creating progress", async () => {
    vi.mocked(setLessonProgress).mockRejectedValue(
        new AppError(403, "COURSE_ENROLLMENT_REQUIRED", "Enroll first"),
    );
    expect(
        (
            await request(app)
                .put(`/api/v1/lessons/${lessonId}/progress`)
                .set(auth)
                .send({ completed: true })
        ).status,
    ).toBe(403);
});
