# API contract conventions

## Source of truth

Zod 4 schemas are the source of truth for runtime request validation, TypeScript input/output
types, response validation, and OpenAPI component schemas. OpenAPI operation metadata such as the
HTTP method, path, summary, and status descriptions lives in `src/openapi/document.ts` because it
has no equivalent in a data schema.

`@asteasolutions/zod-to-openapi` generates OpenAPI 3.1 from the same schemas used by the Express
application. Do not create parallel OpenAPI-only request or response shapes.

## Requests

Define route schemas near the route or its feature under `src/`. Validate each applicable request
boundary at the start of the handler with `validateRequest`:

```ts
const createQuestionRequest = {
    params: z.object({ deckId: z.string().uuid() }),
    query: z.object({ dryRun: z.stringbool().default(false) }),
    body: z.object({ prompt: z.string().trim().min(1) }),
};

const { params, query, body } = validateRequest(request, createQuestionRequest);
```

- Path parameters arrive as strings; validate their format explicitly.
- Query values normally arrive as strings; use deliberate coercion rather than relying on casts.
- Request bodies require `Content-Type: application/json` and are parsed by `express.json()`.
- Omit a schema only when that input location is not used by the operation.

Zod failures become `AppError(400, "VALIDATION_ERROR", "Request validation failed")`. Malformed
JSON uses the same code with a more specific safe message. Validation details are retained as the
error cause for logs but are not exposed to clients.

## Responses

Every JSON success response has an exported Zod schema and `z.output` type. Pass response bodies
through `sendResponse`; this validates the actual body before Express sends it and keeps handler
types tied to the schema.

Use schema `.meta({ id, description })` for reusable OpenAPI component names and documentation.
Register the same schema in the operation's response entry in `src/openapi/document.ts`.

## Errors

All API errors use this envelope:

```json
{
    "error": {
        "code": "STABLE_MACHINE_READABLE_CODE",
        "message": "Safe human-readable message"
    }
}
```

`errorResponseSchema` defines and validates the envelope. Codes use uppercase snake case and are
part of the API contract. Expected failures should throw `AppError`; unexpected errors become
`INTERNAL_SERVER_ERROR` without exposing implementation details. Document the relevant 4xx and
500 responses for every operation.

## OpenAPI artifact

`createOpenApiDocument` generates the document in memory. `npm run openapi:check` validates it and
is the check to add to CI when the repository's initial CI phase is implemented. `npm run build`
writes `dist/openapi.json` alongside compiled application output. The entire `dist/` directory is
ignored, so generated OpenAPI is produced during builds and is not committed.

## Versioning

Routes remain unversioned while the API is internal and has no compatibility commitment. Do not
add a speculative `/v1` prefix. Introduce a versioned public API namespace such as `/api/v1` when
the first external consumer or compatibility requirement makes a versioning policy necessary.
Operational endpoints such as `/health` remain unversioned.
