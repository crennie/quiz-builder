import { app } from "./app.ts";
import { config } from "./config.ts";
import { logger } from "./logger.ts";

const server = app.listen(config.port, () => {
    logger.info({ port: config.port }, "Quiz Builder backend listening");
});

server.on("error", (error) => {
    logger.fatal({ err: error }, "HTTP server failed");
    process.exitCode = 1;
});
