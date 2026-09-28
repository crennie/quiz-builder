import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";

import { AppLayout } from "./layout";
import { HomePage } from "../pages/home-page";
import { NotFoundPage } from "../pages/not-found-page";

const rootRoute = createRootRoute({ component: AppLayout, notFoundComponent: NotFoundPage });
const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: HomePage });

export const router = createRouter({ routeTree: rootRoute.addChildren([homeRoute]) });

declare module "@tanstack/react-router" {
    interface Register {
        router: typeof router;
    }
}
