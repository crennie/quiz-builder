import type { ErrorRequestHandler, RequestHandler } from "express";

import { errorResponseSchema } from "../api/schemas/error.ts";
import { sendResponse } from "../api/response.ts";
import { AppError } from "../errors/app-error.ts";

function isMalformedJsonError(error: unknown): error is Error & { status: 400 } {
    return (
        error instanceof SyntaxError &&
        "status" in error &&
        error.status === 400 &&
        "type" in error &&
        error.type === "entity.parse.failed"
    );
}

function isPayloadTooLargeError(error: unknown): error is Error & { status: 413 } {
    return (
        error instanceof Error &&
        "status" in error &&
        error.status === 413 &&
        "type" in error &&
        error.type === "entity.too.large"
    );
}

export const notFoundHandler: RequestHandler = (request, _response, next) => {
    next(new AppError(404, "NOT_FOUND", `Route ${request.method} ${request.path} was not found`));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, request, response, next) => {
    if (response.headersSent) {
        next(error);
        return;
    }

    let appError: AppError;

    if (error instanceof AppError) {
        appError = error;
    } else if (isMalformedJsonError(error)) {
        appError = new AppError(400, "VALIDATION_ERROR", "Request body must contain valid JSON", {
            cause: error,
        });
    } else if (isPayloadTooLargeError(error)) {
        appError = new AppError(413, "PAYLOAD_TOO_LARGE", "Request body exceeds 256 KiB", {
            cause: error,
        });
    } else {
        appError = new AppError(500, "INTERNAL_SERVER_ERROR", "An unexpected error occurred", {
            cause: error,
        });
    }

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

    sendResponse(response, appError.statusCode, errorResponseSchema, {
        error: {
            code: appError.code,
            message: appError.message,
        },
    });
};
