import express from "express";

import { errorHandler, notFoundHandler } from "./middleware/errors.ts";
import { requestLogger } from "./middleware/request-logging.ts";
import { attemptRouter } from "./routes/attempts.ts";
import { currentUserRouter } from "./routes/current-user.ts";
import { feedbackRouter } from "./routes/feedback.ts";
import { healthRouter } from "./routes/health.ts";
import { questionBankRouter } from "./routes/question-bank.ts";
import { contentWorkflowRouter } from "./routes/content-workflow.ts";
import { quizRouter } from "./routes/quizzes.ts";

export const app = express();

app.use(requestLogger);
app.use(express.json());
app.use(healthRouter);
app.use("/api/v1", currentUserRouter);
app.use("/api/v1", questionBankRouter);
app.use("/api/v1", contentWorkflowRouter);
app.use("/api/v1", quizRouter);
app.use("/api/v1", attemptRouter);
app.use("/api/v1", feedbackRouter);

app.get("/", (_request, response) => {
    response.send("Quiz Builder backend");
});

app.use(notFoundHandler);
app.use(errorHandler);
