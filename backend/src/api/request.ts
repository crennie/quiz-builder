import { AppError } from "../errors/app-error.ts";

type RequestInput = Readonly<{
    params: unknown;
    query: unknown;
    body: unknown;
}>;

type Parseable<Output = unknown> = Readonly<{
    parse: (value: unknown) => Output;
}>;

type RequestSchemas = Readonly<{
    params?: Parseable;
    query?: Parseable;
    body?: Parseable;
}>;

export type ValidatedRequest<Schemas extends RequestSchemas> = {
    [Key in keyof Schemas]: Schemas[Key] extends Parseable<infer Output> ? Output : never;
};

function isZodError(error: unknown): error is Error {
    return (
        error instanceof Error &&
        error.name === "ZodError" &&
        "issues" in error &&
        Array.isArray(error.issues)
    );
}

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
        if (isZodError(error)) {
            throw new AppError(400, "VALIDATION_ERROR", "Request validation failed", {
                cause: error,
            });
        }

        throw error;
    }

    return validated as ValidatedRequest<Schemas>;
}
