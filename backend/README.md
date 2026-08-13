# Quiz Builder backend

## Validation

Run the normal development checks from `backend/` in this order:

```text
npm run typecheck
npm run lint
npm test
npm run openapi:check
npm run build
```

Use `npm run format:check` to verify formatting and `npm run format` to format backend
files. Formatting changes should stay scoped to files already being changed.

The build command compiles production source into the ignored `dist/` directory. Run that output
with `npm start`. Development continues to run TypeScript source directly with `npm run dev`.

## Test conventions

Vitest is the test runner. Test files use the `*.test.ts` suffix and live under:

- `tests/unit/` for isolated functions, classes, and domain logic. Unit tests should avoid HTTP,
  filesystem, database, and other process boundaries.
- `tests/integration/` for interactions between application components. API integration tests use
  Supertest with the exported Express `app`; they do not bind a network port or start `server.ts`.

Run all tests with `npm test`, only unit tests with `npm run test:unit`, or only integration tests
with `npm run test:integration`.

## API contracts

Zod schemas are the source of truth for runtime validation, response typing, and generated OpenAPI
schemas. The conventions for requests, responses, errors, documentation, and versioning are in
[`docs/api-conventions.md`](docs/api-conventions.md).

Run `npm run openapi:check` to generate and structurally validate the document in memory. Run
`npm run openapi:generate` to write `dist/openapi.json`; `npm run build` also writes this file after
compilation. Generated output is a build artifact and is not committed.
