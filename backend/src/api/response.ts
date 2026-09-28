import type { Response } from "express";

type Parseable<Output> = Readonly<{ parse: (value: unknown) => Output }>;

export function sendResponse<Output>(
    response: Response<Output>,
    statusCode: number,
    schema: Parseable<Output>,
    body: Output,
): void {
    response.status(statusCode).json(schema.parse(body));
}
