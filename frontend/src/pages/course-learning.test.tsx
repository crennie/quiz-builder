import { usePlatformAdmin } from "../api/use-platform-admin";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { CourseProgress } from "@quiz-builder/contracts";
import * as coursesApi from "../api/courses";
import * as attemptsApi from "../api/attempts";
import { renderAt } from "../test/render-route";
import { quiz, timestamp } from "../test/domain-fixtures";

vi.mock("../api/use-platform-admin", () => ({ usePlatformAdmin: vi.fn() }));
vi.mock("../api/courses", () => ({
    listCourses: vi.fn(),
    getCourse: vi.fn(),
    listCourseLessons: vi.fn(),
    getLesson: vi.fn(),
    listLessonQuizzes: vi.fn(),
    getCourseProgress: vi.fn(),
    enrollInCourse: vi.fn(),
    setLessonProgress: vi.fn(),
    listEnrolledCourses: vi.fn(),
}));
vi.mock("../api/attempts", () => ({ listLessonAttempts: vi.fn(), startAttempt: vi.fn() }));
const courseId = "623e4567-e89b-42d3-a456-426614174030";
const lessonId = "723e4567-e89b-42d3-a456-426614174030";
const course = {
    id: courseId,
    title: "World geography",
    description: "Explore the world",
    createdAt: timestamp,
    updatedAt: timestamp,
    archivedAt: null,
};
const lesson = {
    id: lessonId,
    courseId,
    title: "European capitals",
    description: null,
    content: "Read about capitals.",
    position: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
    previousLesson: null,
    nextLesson: null,
};
let progress: CourseProgress;
beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal(
        "ResizeObserver",
        class {
            observe() {}
            disconnect() {}
        },
    );
    vi.mocked(usePlatformAdmin).mockReturnValue(false);
    progress = { enrollment: null, completedLessons: [] };
    vi.mocked(coursesApi.getCourse).mockResolvedValue(course);
    vi.mocked(coursesApi.listCourses).mockResolvedValue({ items: [course], nextOffset: null });
    vi.mocked(coursesApi.listCourseLessons).mockResolvedValue({
        items: [lesson],
        nextOffset: null,
    });
    vi.mocked(coursesApi.getLesson).mockResolvedValue(lesson);
    vi.mocked(coursesApi.listLessonQuizzes).mockResolvedValue([
        { id: "association", lessonId, quizId: quiz.id, position: 0, quiz },
    ]);
    vi.mocked(coursesApi.getCourseProgress).mockImplementation(() => Promise.resolve(progress));
    vi.mocked(coursesApi.enrollInCourse).mockImplementation(() => {
        const enrollment = { courseId, enrolledAt: timestamp };
        progress = { ...progress, enrollment };
        return Promise.resolve(enrollment);
    });
    vi.mocked(coursesApi.setLessonProgress).mockImplementation((id, completed) => {
        const saved = { lessonId: id, completedAt: completed ? timestamp : null };
        progress = { ...progress, completedLessons: completed ? [saved] : [] };
        return Promise.resolve(saved);
    });
    vi.mocked(coursesApi.listEnrolledCourses).mockImplementation(() =>
        Promise.resolve({
            items: progress.enrollment
                ? [
                      {
                          course,
                          enrolledAt: timestamp,
                          completedLessons: progress.completedLessons.length,
                          totalLessons: 1,
                      },
                  ]
                : [],
            nextOffset: null,
        }),
    );
    vi.mocked(attemptsApi.listLessonAttempts).mockResolvedValue([]);
});

it("enrolls from Courses and shows the course in My Courses", async () => {
    const user = userEvent.setup();
    renderAt("/courses");
    await user.click(await screen.findByRole("button", { name: "Enroll in World geography" }));
    expect(coursesApi.enrollInCourse).toHaveBeenCalledWith(courseId);
    expect(await screen.findByText(/Enrolled ·/)).toBeInTheDocument();
    await user.click(
        within(screen.getByRole("navigation", { name: "Primary navigation" })).getByRole("link", {
            name: "My Courses",
        }),
    );
    expect(await screen.findByRole("heading", { name: "My Courses" })).toBeInTheDocument();
    expect(await screen.findByText("0 / 1 lessons complete")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Enrolled course World geography/ })).toHaveAttribute(
        "href",
        `/courses/${courseId}`,
    );
});

it("shows an empty learning home with a course discovery link", async () => {
    renderAt("/courses/mine");
    expect(await screen.findByText("Your courses start here")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Find a course" })).toHaveAttribute("href", "/courses");
});

it("requires enrollment for quizzes and persists manual completion and undo", async () => {
    const user = userEvent.setup();
    renderAt(`/courses/${courseId}/lessons/${lessonId}`);
    const practice = await screen.findByText("Enroll in this course to read its lessons.");
    expect(practice).toBeInTheDocument();
    expect(coursesApi.getLesson).not.toHaveBeenCalled();
    expect(coursesApi.listLessonQuizzes).not.toHaveBeenCalled();
    expect(screen.queryByText(lesson.content)).not.toBeInTheDocument();
    expect(screen.queryByRole("checkbox", { name: "Lesson complete" })).not.toBeInTheDocument();
    await user.click(await screen.findByRole("button", { name: "Enroll in World geography" }));
    await user.click(await screen.findByText("Geography"));
    await waitFor(() =>
        expect(screen.getByRole("button", { name: "Start / retry quiz" })).toBeEnabled(),
    );
    await user.click(screen.getAllByRole("checkbox", { name: "Lesson complete" })[0]!);
    await waitFor(() =>
        expect(screen.getAllByRole("checkbox", { name: "Lesson complete" })[0]).toBeChecked(),
    );
    expect(coursesApi.setLessonProgress).toHaveBeenCalledWith(lessonId, true);
    expect(attemptsApi.startAttempt).not.toHaveBeenCalled();
    await user.click(screen.getAllByRole("checkbox", { name: "Lesson complete" })[0]!);
    await waitFor(() =>
        expect(screen.getAllByRole("checkbox", { name: "Lesson complete" })[0]).not.toBeChecked(),
    );
    expect(coursesApi.setLessonProgress).toHaveBeenLastCalledWith(lessonId, false);
});

it("retains the incomplete status after a failed completion save and allows retry", async () => {
    progress.enrollment = { courseId, enrolledAt: timestamp };
    vi.mocked(coursesApi.setLessonProgress).mockRejectedValueOnce(
        new Error("Could not save progress"),
    );
    const user = userEvent.setup();
    renderAt(`/courses/${courseId}/lessons/${lessonId}`);
    await user.click((await screen.findAllByRole("checkbox", { name: "Lesson complete" }))[0]!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save progress");
    expect(screen.getAllByRole("checkbox", { name: "Lesson complete" })[0]).not.toBeChecked();
    await user.click(screen.getAllByRole("checkbox", { name: "Lesson complete" })[0]!);
    await waitFor(() =>
        expect(screen.getAllByRole("checkbox", { name: "Lesson complete" })[0]).toBeChecked(),
    );
});

it("keeps archived course progress visible and disables new learning writes", async () => {
    progress = {
        enrollment: { courseId, enrolledAt: timestamp },
        completedLessons: [{ lessonId, completedAt: timestamp }],
    };
    vi.mocked(coursesApi.getCourse).mockResolvedValue({ ...course, archivedAt: timestamp });
    renderAt(`/courses/${courseId}/lessons/${lessonId}`);
    expect((await screen.findAllByRole("checkbox", { name: "Lesson complete" }))[0]).toBeDisabled();
    await userEvent.click(await screen.findByText("Geography"));
    expect(screen.getByRole("button", { name: "Start / retry quiz" })).toBeDisabled();
});

it("shows saved manual completion on the course overview independently of quiz progress", async () => {
    progress = {
        enrollment: { courseId, enrolledAt: timestamp },
        completedLessons: [{ lessonId, completedAt: timestamp }],
    };
    renderAt(`/courses/${courseId}`);
    expect(await screen.findByText("✓ Lesson complete")).toBeInTheDocument();
    expect(await screen.findByText("0 / 1 quizzes completed")).toBeInTheDocument();
});

it("only offers lesson import while the admin is in edit mode", async () => {
    vi.mocked(usePlatformAdmin).mockReturnValue(true);
    const user = userEvent.setup();
    renderAt(`/courses/${courseId}`);
    await screen.findByRole("heading", { name: course.title });
    expect(screen.queryByRole("link", { name: "Import lessons" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edit course" }));
    expect(screen.getByRole("link", { name: "Import lessons" })).toHaveAttribute(
        "href",
        `/courses/${courseId}/import`,
    );
    await user.click(screen.getByRole("button", { name: "Done editing course" }));
    expect(screen.queryByRole("link", { name: "Import lessons" })).not.toBeInTheDocument();
});

it("shows lesson titles without reading links or editing controls before enrollment", async () => {
    renderAt(`/courses/${courseId}`);
    expect(await screen.findByRole("heading", { name: lesson.title })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Start reading/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /European capitals/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit course" })).not.toBeInTheDocument();
    expect(coursesApi.listLessonQuizzes).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole("button", { name: "Enroll in World geography" }));
    expect(await screen.findByRole("link", { name: /Start reading/ })).toBeInTheDocument();
});
it("allows enrolled learners to read without offering lesson editing", async () => {
    progress.enrollment = { courseId, enrolledAt: timestamp };
    renderAt(`/courses/${courseId}/lessons/${lessonId}`);
    expect(await screen.findByText(lesson.content)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit lesson" })).not.toBeInTheDocument();
});
