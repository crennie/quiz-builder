import type { ErrorRequestHandler, RequestHandler } from "express";

import { AppError } from "../errors/app-error.ts";

export const notFoundHandler: RequestHandler = (request, _response, next) => {
    next(new AppError(404, "NOT_FOUND", `Route ${request.method} ${request.path} was not found`));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, next) => {
    if (response.headersSent) {
        next(error);
        return;
    }

    const appError =
        error instanceof AppError
            ? error
            : new AppError(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred", {
                  cause: error,
              });

    const logContext = {
        err: error,
        errorCode: appError.code,
        statusCode: appError.statusCode,
    };

    if (appError.statusCode >= 500) {
        request.log.error(logContext, "Request failed");
    } else {
        request.log.warn(logContext, "Request failed");
    }

    response.status(appError.statusCode).json({
        error: {
            code: appError.code,
            message: appError.message,
        },
    });
};
