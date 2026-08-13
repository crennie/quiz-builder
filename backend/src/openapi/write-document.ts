import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createOpenApiDocument } from "./document.ts";

const outputDirectory = resolve(process.cwd(), "dist");
const outputPath = resolve(outputDirectory, "openapi.json");

await mkdir(outputDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(createOpenApiDocument(), null, 2)}\n`, "utf8");

process.stdout.write(`Generated ${outputPath}\n`);
