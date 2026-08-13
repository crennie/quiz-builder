import pino from "pino";

import { config } from "./config.ts";

const sensitiveFields = ["password", "token", "accessToken", "refreshToken", "apiKey"];

export const logger = pino({
    level: "info",
    base: {
        service: "quiz-builder-backend",
        environment: config.nodeEnv,
    },
    redact: {
        paths: [
            "req.headers.authorization",
            "req.headers.cookie",
            "res.headers['set-cookie']",
            ...sensitiveFields,
            ...sensitiveFields.map((field) => `*.${field}`),
            ...sensitiveFields.map((field) => `req.body.${field}`),
        ],
        censor: "[REDACTED]",
    },
});
