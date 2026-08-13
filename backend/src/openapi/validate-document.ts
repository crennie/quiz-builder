import SwaggerParser from "@apidevtools/swagger-parser";
import type { OpenAPIV3_1 } from "openapi-types";

import { createOpenApiDocument } from "./document.ts";

export async function validateOpenApiDocument(): Promise<void> {
    const document = createOpenApiDocument() as unknown as OpenAPIV3_1.Document;

    await SwaggerParser.validate(document);
}
