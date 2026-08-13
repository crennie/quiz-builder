import { logger } from "../logger.ts";
import { checkDatabaseConnection, closeDatabase } from "./index.ts";

try {
    await checkDatabaseConnection();
    logger.info("Database connection succeeded");
} catch (error: unknown) {
    logger.error({ err: error }, "Database connection failed");
    process.exitCode = 1;
} finally {
    await closeDatabase();
}
