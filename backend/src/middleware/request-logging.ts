import { pinoHttp } from "pino-http";

import { logger } from "../logger.ts";

export const requestLogger = pinoHttp({
    logger,
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
