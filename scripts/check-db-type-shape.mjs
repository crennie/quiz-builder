import { writeFileSync, unlinkSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
export function checkDatabaseTypeShape(candidate) {
    const candidatePath = resolve("shared/.db-types-candidate.ts");
    const checkPath = resolve("shared/.db-types-check.ts");
    try {
        writeFileSync(candidatePath, candidate);
        writeFileSync(
            checkPath,
            `import type {Database as Actual} from './src/database.types.ts';
import type {Database as Expected} from './.db-types-candidate.ts';
type Assert<T extends true>=T;
type Equal<A,B>=[A] extends [B]?([B] extends [A]?true:false):false;
type Normalize<T>={ [K in keyof T]: { [P in keyof T[K]]: P extends 'Relationships' ? T[K][P] extends readonly unknown[] ? T[K][P][number] : never : T[K][P] } };
type CheckTableKeys=Assert<Equal<keyof Actual['public']['Tables'],keyof Expected['public']['Tables']>>;
type CheckTables=Assert<Equal<Normalize<Actual['public']['Tables']>,Normalize<Expected['public']['Tables']>>>;
type CheckEnums=Assert<Equal<Actual['public']['Enums'],Expected['public']['Enums']>>;
`,
        );
        const program = ts.createProgram([checkPath], {
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            allowImportingTsExtensions: true,
            target: ts.ScriptTarget.ES2024,
            module: ts.ModuleKind.NodeNext,
            moduleResolution: ts.ModuleResolutionKind.NodeNext,
            types: [],
        });
        const diagnostics = ts.getPreEmitDiagnostics(program);
        if (diagnostics.length)
            throw new Error(
                `Database type shape differs from the generated schema:\n${ts.formatDiagnosticsWithColorAndContext(diagnostics, { getCanonicalFileName: (f) => f, getCurrentDirectory: () => process.cwd(), getNewLine: () => "\n" })}`,
            );
    } finally {
        for (const file of [candidatePath, checkPath]) {
            try {
                unlinkSync(file);
            } catch (error) {
                if (error.code !== "ENOENT") throw error;
            }
        }
    }
}
