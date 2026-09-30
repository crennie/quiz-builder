import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const checklist = readFileSync(resolve(root, "docs/use-cases.md"), "utf8");
const manifest = JSON.parse(readFileSync(resolve(root, "docs/use-case-tests.json"), "utf8"));
const rows = [
    ...checklist.matchAll(/^- \[(x| )\] \*\*([A-Z]+-\d{2})(?: · (UI\/API|UI|API|Rule))?\*\*/gm),
];
const cases = new Map(rows.map(([, status, id, kind]) => [id, { status, kind, references: [] }]));

assert.equal(cases.size, rows.length, "Use-case IDs must be unique");

for (const { file, name, ids } of manifest.tests) {
    assert.match(
        file,
        /^(frontend|backend|shared)\//,
        `Test path is outside a test package: ${file}`,
    );
    assert.match(file, /\.(test|spec)\.[cm]?[jt]sx?$/, `Not a test file: ${file}`);
    const source = readFileSync(resolve(root, file), "utf8");
    assert.ok(
        source.includes(`it("${name}"`) || source.includes(`test("${name}"`),
        `Test case was not found: ${file} :: ${name}`,
    );
    assert.ok(Array.isArray(ids) && ids.length > 0, `No use cases mapped to ${file} :: ${name}`);
    for (const id of ids) {
        const entry = cases.get(id);
        assert.ok(entry, `Unknown use-case ID ${id} in ${file} :: ${name}`);
        assert.equal(entry.status, "x", `Open use case ${id} is mapped as covered`);
        entry.references.push(file);
    }
}

for (const [id, entry] of cases) {
    if (entry.status !== "x") continue;
    assert.ok(entry.references.length > 0, `Checked use case ${id} has no test`);
    if (entry.kind?.includes("UI")) {
        assert.ok(
            entry.references.some((file) => file.startsWith("frontend/")),
            `${id} lacks a UI test`,
        );
    }
    if (entry.kind?.includes("API") || entry.kind === "Rule") {
        assert.ok(
            entry.references.some(
                (file) => file.startsWith("backend/") || file.startsWith("shared/"),
            ),
            `${id} lacks a domain/API test`,
        );
    }
}

const covered = [...cases.values()].filter((entry) => entry.status === "x").length;
console.log(`Use-case coverage references verified for ${covered} checked cases.`);
