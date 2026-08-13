import express from "express";

import { healthRouter } from "./routes/health.ts";

export const app = express();

app.use(healthRouter);

app.get("/", (_request, response) => {
    response.send("Quiz Builder backend");
});
