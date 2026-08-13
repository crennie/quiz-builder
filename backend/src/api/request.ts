import { z } from "zod";

import { AppError } from "../errors/app-error.ts";

type RequestInput = Readonly<{
    params: unknown;
    query: unknown;
    body: unknown;
}>;

type RequestSchemas = Readonly<{
    params?: z.ZodType;
    query?: z.ZodType;
    body?: z.ZodType;
}>;

export type ValidatedRequest<Schemas extends RequestSchemas> = {
    [Key in keyof Schemas]: Schemas[Key] extends z.ZodType ? z.output<Schemas[Key]> : never;
};

export function validateRequest<Schemas extends RequestSchemas>(
    request: RequestInput,
    schemas: Schemas,
): ValidatedRequest<Schemas> {
    const validated: Partial<Record<keyof RequestSchemas, unknown>> = {};

    try {
        if (schemas.params !== undefined) {
            validated.params = schemas.params.parse(request.params);
        }

        if (schemas.query !== undefined) {
            validated.query = schemas.query.parse(request.query);
        }

        if (schemas.body !== undefined) {
            validated.body = schemas.body.parse(request.body);
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", {
                cause: error,
            });
        }

        throw error;
    }

    return validated as ValidatedRequest<Schemas>;
}
