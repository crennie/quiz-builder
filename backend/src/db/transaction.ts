import type { Pool, PoolClient } from "pg";

import { pool } from "./index.ts";

export async function withTransaction<Result>(
    work: (client: PoolClient) => Promise<Result>,
    databasePool: Pick<Pool, "connect"> = pool,
): Promise<Result> {
    const client = await databasePool.connect();
    let transactionStarted = false;
    let released = false;

    try {
        await client.query("BEGIN");
        transactionStarted = true;
        const result = await work(client);
        await client.query("COMMIT");
        return result;
    } catch (error) {
        if (!transactionStarted) {
            client.release(error instanceof Error ? error : new Error(String(error)));
            released = true;
        } else {
            try {
                await client.query("ROLLBACK");
            } catch (rollbackError) {
                client.release(
                    rollbackError instanceof Error
                        ? rollbackError
                        : new Error(String(rollbackError)),
                );
                released = true;
                throw new AggregateError(
                    [error, rollbackError],
                    "Transaction and rollback failed",
                    {
                        cause: rollbackError,
                    },
                );
            }
        }

        throw error;
    } finally {
        // A failed rollback has already removed the client from the pool.
        if (!released) client.release();
    }
}
