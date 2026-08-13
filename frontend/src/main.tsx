import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router-dom";

import { AppErrorBoundary } from "./app/app-error-boundary";
import { createQueryClient } from "./app/query-client";
import { router } from "./app/router";
import "./styles.css";

const rootElement = document.getElementById("root");

if (!rootElement) throw new Error("Application root element was not found.");

createRoot(rootElement).render(
    <StrictMode>
        <AppErrorBoundary>
            <QueryClientProvider client={createQueryClient()}>
                <RouterProvider router={router} />
            </QueryClientProvider>
        </AppErrorBoundary>
    </StrictMode>,
);
