import type { Pool, PoolClient } from "pg";
import { describe, expect, it, vi } from "vitest";

import { withTransaction } from "../../src/db/transaction.ts";

function fakeDatabase() {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const release = vi.fn();
    const client = { query, release } as unknown as PoolClient;
    const connect = vi.fn().mockResolvedValue(client);
    const databasePool = { connect } as unknown as Pool;
    return { query, release, connect, client, databasePool };
}

describe("withTransaction", () => {
    it("commits and releases a successful transaction", async () => {
        const db = fakeDatabase();
        const result = await withTransaction(async (client) => {
            expect(client).toBe(db.client);
            await client.query("SELECT 1");
            return "done";
        }, db.databasePool);

        expect(result).toBe("done");
        expect(db.query).toHaveBeenNthCalledWith(1, "BEGIN");
        expect(db.query).toHaveBeenNthCalledWith(2, "SELECT 1");
        expect(db.query).toHaveBeenNthCalledWith(3, "COMMIT");
        expect(db.release).toHaveBeenCalledOnce();
    });

    it("rolls back and releases when work fails", async () => {
        const db = fakeDatabase();
        const failure = new Error("work failed");

        await expect(withTransaction(() => Promise.reject(failure), db.databasePool)).rejects.toBe(
            failure,
        );

        expect(db.query).toHaveBeenNthCalledWith(1, "BEGIN");
        expect(db.query).toHaveBeenNthCalledWith(2, "ROLLBACK");
        expect(db.release).toHaveBeenCalledOnce();
    });

    it("discards a client when BEGIN fails", async () => {
        const db = fakeDatabase();
        const failure = new Error("connection failed");
        db.query.mockRejectedValueOnce(failure);

        await expect(
            withTransaction(() => Promise.resolve("unused"), db.databasePool),
        ).rejects.toBe(failure);

        expect(db.release).toHaveBeenCalledExactlyOnceWith(failure);
    });
});
