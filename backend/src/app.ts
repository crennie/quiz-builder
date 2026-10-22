import { COURSE_CONTENT_MAX_BYTES } from "@quiz-builder/contracts";
import express from "express";

import { errorHandler, notFoundHandler } from "./middleware/errors.ts";
import { requestLogger } from "./middleware/request-logging.ts";
import { attemptRouter } from "./routes/attempts.ts";
import { currentUserRouter } from "./routes/current-user.ts";
import { feedbackRouter } from "./routes/feedback.ts";
import { healthRouter } from "./routes/health.ts";
import { questionBankRouter } from "./routes/question-bank.ts";
import { questionBatchRouter } from "./routes/question-batches.ts";
import { courseRouter } from "./routes/courses.ts";
import { quizRouter } from "./routes/quizzes.ts";

export const app = express();

app.use(requestLogger);
// Parse larger course content before applying the default limit to other requests.
const courseContentJson = express.json({ limit: COURSE_CONTENT_MAX_BYTES });
app.post(["/api/v1/courses/import", "/api/v1/courses/:courseId/lessons/import"], courseContentJson);
app.put("/api/v1/lessons/:lessonId", courseContentJson);
app.use(express.json({ limit: "256kb" }));
app.use(healthRouter);
app.use("/api/v1", currentUserRouter);
app.use("/api/v1", questionBankRouter);
app.use("/api/v1", questionBatchRouter);
app.use("/api/v1", quizRouter);
app.use("/api/v1", courseRouter);
app.use("/api/v1", attemptRouter);
app.use("/api/v1", feedbackRouter);

app.get("/", (_request, response) => {
    response.send("Quiz Builder backend");
});

app.use(notFoundHandler);
app.use(errorHandler);
