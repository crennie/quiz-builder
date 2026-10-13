export const baselineVersion: string;
export const replacedVersions: string[];
export const contentTables: string[];
export function applicationRebuildSql(): string;
export function inspectRebuild(
    database: unknown,
    preservedId: string,
): Promise<{ profiles: unknown[]; authIds: unknown[] }>;
