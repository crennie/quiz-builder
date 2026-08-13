export class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: string;

    constructor(
        statusCode: number,
        code: string,
        message: string,
        options?: ErrorOptions,
    ) {
        super(message, options);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.code = code;
    }
}
