import { randomUUID } from "node:crypto";

import { pinoHttp } from "pino-http";

import { logger } from "../logger.ts";

export const requestLogger = pinoHttp({
    logger,
    genReqId(request, response) {
        const receivedId = request.headers["x-request-id"];
        const requestId =
            typeof receivedId === "string" && /^[A-Za-z0-9._:-]{1,128}$/.test(receivedId)
                ? receivedId
                : randomUUID();

        response.setHeader("x-request-id", requestId);
        return requestId;
    },
    customLogLevel(_request, response, error) {
        if (error !== undefined || response.statusCode >= 500) {
            return "error";
        }

        if (response.statusCode >= 400) {
            return "warn";
        }

        return "info";
    },
});
