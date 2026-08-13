import express from "express";

import { errorHandler, notFoundHandler } from "./middleware/errors.ts";
import { requestLogger } from "./middleware/request-logging.ts";
import { healthRouter } from "./routes/health.ts";

export const app = express();

app.use(requestLogger);
app.use(express.json());
app.use(healthRouter);

app.get("/", (_request, response) => {
    response.send("Quiz Builder backend");
});

app.use(notFoundHandler);
app.use(errorHandler);
