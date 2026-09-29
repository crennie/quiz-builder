import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

import { AppLayout } from "./layout";
import { HomePage } from "../pages/home-page";
import { NotFoundPage } from "../pages/not-found-page";
import { SignInPage } from "../pages/sign-in-page";
import { RequireAuth } from "../auth/require-auth";
import { QuestionBankPage } from "../pages/question-bank-page";
import { NewQuestionPage } from "../pages/new-question-page";
import { QuestionDetailPage } from "../pages/question-detail-page";

const rootRoute = createRootRoute({ component: AppLayout, notFoundComponent: NotFoundPage });
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: HomePage });
const signInRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/sign-in",
    component: SignInPage,
});
const questionBankRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/questions",
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
const questionDetailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/questions/$questionId",
    component: () => (
        <RequireAuth>
            <QuestionDetailPage />
        </RequireAuth>
    ),
});

export const router = createRouter({
    routeTree: rootRoute.addChildren([
        homeRoute,
        signInRoute,
        questionBankRoute,
        newQuestionRoute,
        questionDetailRoute,
    ]),
});

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}
