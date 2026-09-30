import { symbols } from "pino";
import { afterEach, describe, expect, it, vi } from "vitest";

import { logger } from "../../src/logger.ts";

describe("structured logging", () => {
    const originalLevel = logger.level;

    afterEach(() => {
        logger.level = originalLevel;
        vi.restoreAllMocks();
    });

    it("writes structured records with service context and redacts credentials", () => {
        const lines: string[] = [];
        const stream = Reflect.get(logger, symbols.streamSym) as { write(chunk: string): boolean };
        vi.spyOn(stream, "write").mockImplementation((chunk) => {
            lines.push(String(chunk));
            return true;
        });
        logger.level = "info";
        logger.info(
            { password: "private", req: { headers: { authorization: "Bearer private" } } },
            "request",
        );

        const record = JSON.parse(lines.at(-1) ?? "null") as {
            service?: string;
            msg?: string;
            password?: string;
            req?: { headers?: { authorization?: string } };
        };
        expect(record).toMatchObject({
            service: "quiz-builder-backend",
            msg: "request",
            password: "[REDACTED]",
            req: { headers: { authorization: "[REDACTED]" } },
        });
    });
});
