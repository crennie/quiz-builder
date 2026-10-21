# Quiz Builder frontend

React/Vite/TypeScript with TanStack Router/Query and Vitest. Use Node.js 24 and npm. On a fresh
checkout run `npm ci` and `npm run build:shared` at root, then `npm ci` here.

## Commands and configuration

`npm run dev` starts Vite on 5173. Available checks are `typecheck`, `lint`, `format:check`, `test` and
`build`; `test:watch` runs Vitest interactively and `preview` serves the production bundle.
Start the backend separately. Vite proxies `/api/*` to localhost:3000; `/api/health` maps to `/health`.
Copy `.env.example` to ignored `.env.local`, configuring the same Supabase URL/publishable key as the
backend. `VITE_API_BASE_URL` defaults to `/api`. Browser environment values must contain no secrets.

Protected API clients attach the current Supabase access token; public course reads are anonymous.
All clients validate responses with shared Zod schemas.
Query owns server state; local editing state lives in components. Routes share the app layout and
query/error/loading states. Semantic HTML and native accessible controls remain the UI convention.

## Personal content

Sign in and open **My questions**. Prompt search applies to the current page; tags filter on the
server and pagination is explicit. Create owner-scoped tags here and assign them on content pages.
New questions are private automatically. The editor supports exact text and single/multiple choice.
Unused private questions can be edited directly. Used questions show their permanent lock and a link
to create a replacement; public questions are read-only. No version, publication or lifecycle controls exist.

**Import question batch** accepts a JSON artifact, shows its full content, retains it, then creates
usable private questions through **Create private questions**. Tags/mappings are retained atomically.
[The REST example](../docs/examples/rest-endpoints-batch.json) documents file format; its schemaVersion
is a format identifier rather than an entity version. No review, queue or provider step exists.

**Quizzes** lists available public and personal quizzes, with a My quizzes filter. Creation is private.
Choose personal questions by ID, or add an accessible public question using its known UUID. Preserve
question ordering, repeat questions if desired, and set points/required/timing and display settings.
Equivalent saves are harmless. A quiz with any attempt shows content read-only and a replacement
creation link; tags remain editable. Public quiz authoring and course editors are deferred.

## Courses and lessons

**Courses** is public and lists existing courses. Open a course for its ordered lesson outline,
then read lessons with section links and previous/next navigation. The reading layout supports
light/dark themes and narrow screens. There are no enrollment, completion, or quiz attachment controls.

Signed-in users can choose **Import course**, or **Import lessons** on any course overview. Select a
JSON file, expand lessons to preview their content, then import public content. Lessons append in
file order; no existing content is overwritten. Failed requests can be retried on the same page
without duplicates. Reselecting a file or reloading begins a new import.

Download examples: [course](public/sample-course.json), [lessons](public/sample-lessons.json).
Limits are 100 lessons and 256 KiB per import. Content supports plain text and basic Markdown
(headings, flat lists, quotes, code, emphasis, and HTTP(S)/mailto links); HTML and images are not
rendered. Full CommonMark and rich-media support are deferred.

## Practice and feedback

Start a nonempty owned private or public quiz. Refreshing an attempt URL restores saved progress;
**Attempts** lists resumable attempts and results. Answer one question at a time and complete after
all required answers. Results present snapshot points and per-question review; correct answers and
explanations follow saved settings. Feedback can target a question, quiz or attempted question.

## Browser checks

`npm run test:e2e` starts API/Vite against a fresh local Supabase stack and creates isolated test
users/content. Install Chromium with `npx playwright install chromium` when needed. If using
`E2E_USE_APP_ENV=true`, both application env files must refer to an explicitly approved disposable
project with the V1 schema; this mode writes users/content. Never use the preserved-account database
for destructive tests. See [current architecture](../docs/architecture/README.md) and
[the schema cutover procedure](../docs/plans/v1-schema-rebuild.md).
