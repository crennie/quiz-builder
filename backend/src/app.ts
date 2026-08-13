import express from "express";

export const app = express();

app.get("/", (_request, response) => {
    response.send("Quiz Builder backend");
});
