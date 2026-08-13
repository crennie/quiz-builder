import { app } from "./app.ts";
import { config } from "./config.ts";
import { closeDatabase } from "./db/index.ts";
import { logger } from "./logger.ts";

const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, "Quiz Builder backend listening");
});

server.on("error", (error) => {
    logger.fatal({ err: error }, "HTTP server failed");
    process.exitCode = 1;
});

let shutdownPromise: Promise<void> | undefined;

function shutdown(signal: NodeJS.Signals): Promise<void> {
    shutdownPromise ??= (async () => {
        logger.info({ signal }, "Shutting down");

        await new Promise<void>((resolve, reject) => {
            server.close((error) => {
                if (error) reject(error);
                else resolve();
            });
        });

        await closeDatabase();
        logger.info("Shutdown complete");
    })().catch((error: unknown) => {
        logger.error({ err: error }, "Graceful shutdown failed");
        process.exitCode = 1;
    });

    return shutdownPromise;
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
        void shutdown(signal);
    });
}
