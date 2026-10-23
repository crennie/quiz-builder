import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

import { AppLayout } from "./layout";
import { ProfilePage } from "../pages/profile-page";
import { HomePage } from "../pages/home-page";
import { NotFoundPage } from "../pages/not-found-page";
import { SignInPage } from "../pages/sign-in-page";
import { RequireAuth } from "../auth/require-auth";
import { QuestionBankPage } from "../pages/question-bank-page";
import { NewQuestionPage } from "../pages/new-question-page";
import { QuestionDetailPage } from "../pages/question-detail-page";
import { MyQuizzesPage } from "../pages/my-quizzes-page";
import { MyCoursesPage } from "../pages/my-courses-page";
import { CoursesPage } from "../pages/courses-page";
import { CourseDetailPage } from "../pages/course-detail-page";
import { LessonPage } from "../pages/lesson-page";
import { ImportCoursePage, ImportLessonsPage } from "../pages/import-course-page";
import { ImportQuizPage } from "../pages/import-quiz-page";
import { NewQuizPage } from "../pages/new-quiz-page";
import { QuizDetailPage } from "../pages/quiz-detail-page";
import { AttemptHistoryPage } from "../pages/attempt-history-page";
import { AttemptPage } from "../pages/attempt-page";
import { QuestionBatchPage } from "../pages/question-batch-page";

const rootRoute = createRootRoute({ component: AppLayout, notFoundComponent: NotFoundPage });
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: HomePage });
const signInRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/sign-in",
    component: SignInPage,
});
const profileRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/profile",
    component: () => (
        <RequireAuth>
            <ProfilePage />
        </RequireAuth>
    ),
});
const myQuestionsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/questions/mine",
    component: () => (
        <RequireAuth>
            <QuestionBankPage />
        </RequireAuth>
    ),
});
const newQuestionRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/questions/new",
    component: () => (
        <RequireAuth>
            <NewQuestionPage />
        </RequireAuth>
    ),
});
const questionBatchRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/questions/batches",
    component: () => (
        <RequireAuth>
            <QuestionBatchPage />
        </RequireAuth>
    ),
});
const questionDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/questions/$questionId",
    component: () => (
        <RequireAuth>
            <QuestionDetailPage />
        </RequireAuth>
    ),
});
const quizListRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/quizzes",
    component: () => (
        <RequireAuth>
            <MyQuizzesPage />
        </RequireAuth>
    ),
});
const myCoursesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/courses/mine",
    component: () => (
        <RequireAuth>
            <MyCoursesPage />
        </RequireAuth>
    ),
});
const coursesRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/courses",
    component: CoursesPage,
});
const courseDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/courses/$courseId",
    component: CourseDetailPage,
});
const lessonRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/courses/$courseId/lessons/$lessonId",
    component: LessonPage,
});
const importCourseRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/courses/import",
    component: () => (
        <RequireAuth>
            <ImportCoursePage />
        </RequireAuth>
    ),
});
const importLessonsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/courses/$courseId/import",
    component: () => (
        <RequireAuth>
            <ImportLessonsPage />
        </RequireAuth>
    ),
});
const newQuizRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/quizzes/new",
    component: () => (
        <RequireAuth>
            <NewQuizPage />
        </RequireAuth>
    ),
});
const importQuizRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/quizzes/import",
    component: () => (
        <RequireAuth>
            <ImportQuizPage />
        </RequireAuth>
    ),
});
const quizDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/quizzes/$quizId",
    component: () => (
        <RequireAuth>
            <QuizDetailPage />
        </RequireAuth>
    ),
});
const attemptHistoryRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/attempts",
    component: () => (
        <RequireAuth>
            <AttemptHistoryPage />
        </RequireAuth>
    ),
});
const attemptRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/attempts/$attemptId",
    component: () => (
        <RequireAuth>
            <AttemptPage />
        </RequireAuth>
    ),
});

export const router = createRouter({
    routeTree: rootRoute.addChildren([
        homeRoute,
        signInRoute,
        profileRoute,
        myQuestionsRoute,
        newQuestionRoute,
        questionBatchRoute,
        questionDetailRoute,
        quizListRoute,
        coursesRoute,
        myCoursesRoute,
        courseDetailRoute,
        lessonRoute,
        importCourseRoute,
        importLessonsRoute,
        newQuizRoute,
        importQuizRoute,
        quizDetailRoute,
        attemptHistoryRoute,
        attemptRoute,
    ]),
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}
