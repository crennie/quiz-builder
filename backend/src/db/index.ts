import { Pool } from "pg";

import { config } from "../config.ts";

export const pool = new Pool({
    connectionString: config.databaseUrl,
    connectionTimeoutMillis: 5_000,
});

export async function checkDatabaseConnection(): Promise<void> {
    await pool.query("select 1");
}

export async function closeDatabase(): Promise<void> {
    await pool.end();
}
