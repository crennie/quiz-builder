import express from "express";

import { errorHandler, notFoundHandler } from "./middleware/errors.ts";
import { requestLogger } from "./middleware/request-logging.ts";
import { currentUserRouter } from "./routes/current-user.ts";
import { healthRouter } from "./routes/health.ts";
import { questionBankRouter } from "./routes/question-bank.ts";

export const app = express();

app.use(requestLogger);
app.use(express.json());
app.use(healthRouter);
app.use("/api/v1", currentUserRouter);
app.use("/api/v1", questionBankRouter);

app.get("/", (_request, response) => {
    response.send("Quiz Builder backend");
});

app.use(notFoundHandler);
app.use(errorHandler);
