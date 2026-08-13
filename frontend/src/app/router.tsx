import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "./layout";
import { HomePage } from "../pages/home-page";
import { NotFoundPage } from "../pages/not-found-page";

export const router = createBrowserRouter([
    {
        path: "/",
        Component: AppLayout,
        children: [
            { index: true, Component: HomePage },
            { path: "*", Component: NotFoundPage },
        ],
    },
]);
