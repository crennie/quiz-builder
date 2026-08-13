import type { Response } from "express";
import type { z } from "zod";

export function sendResponse<Schema extends z.ZodType>(
    response: Response<z.output<Schema>>,
    statusCode: number,
    schema: Schema,
    body: z.input<Schema>,
): void {
    response.status(statusCode).json(schema.parse(body));
}
