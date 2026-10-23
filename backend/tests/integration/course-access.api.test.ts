import request from "supertest";
import { beforeEach, expect, it, vi } from "vitest";
import { verifyAccessToken } from "../../src/auth/supabase.ts";
import { getOrCreateProfile } from "../../src/db/profiles.ts";
import {
    getLesson,
    getLessonDetail,
    listCourseLessons,
    listLessonQuizzes,
    setCourseArchived,
} from "../../src/db/courses.ts";
import { assertCourseEnrollment } from "../../src/db/course-progress.ts";
import { importCourseContent } from "../../src/db/course-imports.ts";
import { saveLesson } from "../../src/db/lesson-editing.ts";
import { AppError } from "../../src/errors/app-error.ts";
vi.mock("../../src/auth/supabase.ts", () => ({ verifyAccessToken: vi.fn() }));
vi.mock("../../src/db/profiles.ts", () => ({ getOrCreateProfile: vi.fn() }));
vi.mock("../../src/db/courses.ts", () => ({
    getLesson: vi.fn(),
    getLessonDetail: vi.fn(),
    listCourseLessons: vi.fn(),
    listLessonQuizzes: vi.fn(),
    setCourseArchived: vi.fn(),
}));
vi.mock("../../src/db/course-progress.ts", () => ({ assertCourseEnrollment: vi.fn() }));
vi.mock("../../src/db/course-imports.ts", () => ({ importCourseContent: vi.fn() }));
vi.mock("../../src/db/lesson-editing.ts", () => ({ saveLesson: vi.fn() }));
import { app } from "../../src/app.ts";
const id = "00000000-0000-4000-8000-000000000101";
const courseId = "00000000-0000-4000-8000-000000000201";
const timestamp = "2026-10-23T00:00:00.000Z";
const profile = {
    id,
    displayName: "User",
    avatarUrl: null,
    isPlatformAdmin: false,
    createdAt: new Date(timestamp),
    updatedAt: new Date(timestamp),
};
const lesson = {
    id,
    courseId,
    title: "Lesson",
    description: null,
    content: "Private reading",
    position: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    previousLesson: null,
    nextLesson: null,
};
const auth = { Authorization: "Bearer valid" };
beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(verifyAccessToken).mockResolvedValue({
        id,
        userMetadata: { is_platform_admin: true },
    });
    vi.mocked(getOrCreateProfile).mockResolvedValue(profile);
    vi.mocked(getLesson).mockResolvedValue(lesson);
    vi.mocked(getLessonDetail).mockResolvedValue(lesson);
    vi.mocked(listLessonQuizzes).mockResolvedValue({ items: [], nextOffset: null });
});
it("rejects all authoring routes for anonymous and ordinary users, regardless of metadata or body flags", async () => {
    for (const [method, path] of [
        ["post", "/courses/import"],
        ["post", `/courses/${courseId}/lessons/import`],
        ["put", `/lessons/${id}`],
        ["put", `/courses/${courseId}/archive`],
    ] as const) {
        expect((await request(app)[method](`/api/v1${path}`)).status).toBe(401);
        const write = request(app)[method](`/api/v1${path}`);
        expect((await write.set(auth).send({ is_platform_admin: true })).status).toBe(403);
    }
    expect(saveLesson).not.toHaveBeenCalled();
    expect(importCourseContent).not.toHaveBeenCalled();
    expect(setCourseArchived).not.toHaveBeenCalled();
});
it("allows DB-authorized admins through each authoring guard", async () => {
    vi.mocked(getOrCreateProfile).mockResolvedValue({ ...profile, isPlatformAdmin: true });
    // Empty bodies fail validation only after passing the admin guard.
    for (const [method, path] of [
        ["post", "/courses/import"],
        ["post", `/courses/${courseId}/lessons/import`],
        ["put", `/lessons/${id}`],
        ["put", `/courses/${courseId}/archive`],
    ] as const) {
        expect((await request(app)[method](`/api/v1${path}`).set(auth).send({})).status).toBe(400);
    }
    vi.mocked(setCourseArchived).mockResolvedValue({
        id: courseId,
        title: "Course",
        description: null,
        createdAt: timestamp,
        updatedAt: timestamp,
        archivedAt: timestamp,
    });
    expect(
        (
            await request(app)
                .put(`/api/v1/courses/${courseId}/archive`)
                .set(auth)
                .send({ archived: true })
        ).status,
    ).toBe(200);
});
it("keeps summaries public and strips full lesson content", async () => {
    vi.mocked(listCourseLessons).mockResolvedValue({ items: [lesson], nextOffset: null });
    const response = await request(app).get(`/api/v1/courses/${courseId}/lessons`);
    expect(response.status).toBe(200);
    const body = response.body as { items: Record<string, unknown>[] };
    expect(body.items[0]).toMatchObject({ title: "Lesson" });
    expect(body.items[0]).not.toHaveProperty("content");
});
it("requires enrollment for full lesson and quiz reads, with an admin editing exemption", async () => {
    for (const path of [`/lessons/${id}`, `/lessons/${id}/quizzes`]) {
        expect((await request(app).get(`/api/v1${path}`)).status).toBe(401);
        vi.mocked(assertCourseEnrollment).mockRejectedValueOnce(
            new AppError(403, "COURSE_ENROLLMENT_REQUIRED", "Enroll first"),
        );
        expect((await request(app).get(`/api/v1${path}`).set(auth)).status).toBe(403);
        expect((await request(app).get(`/api/v1${path}`).set(auth)).status).toBe(200);
    }
    expect(assertCourseEnrollment).toHaveBeenCalledWith(courseId, id, expect.anything());
    vi.mocked(assertCourseEnrollment).mockClear();
    vi.mocked(getOrCreateProfile).mockResolvedValue({ ...profile, isPlatformAdmin: true });
    expect((await request(app).get(`/api/v1/lessons/${id}`).set(auth)).body).toMatchObject({
        content: lesson.content,
    });
    expect(assertCourseEnrollment).not.toHaveBeenCalled();
});
