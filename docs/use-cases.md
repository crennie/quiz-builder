# Quiz Builder use-case checklist

This is the product inventory as implemented on 2026-09-30, organized as **epic → feature → use case**. It covers user journeys, UI behavior, API operations, domain rules, and visible gaps. The [architecture plan](../architecture-plan.md) defines v1; the [current architecture](architecture/README.md) and source code determine the checked state.

- `[x]` means the behavior has an implementation path in the repository. It does **not** mean a browser test exists or that a live deployment was verified.
- `[ ]` means the behavior is missing or only partially implemented. Some unchecked items are candidate improvements rather than committed v1 requirements. Split rows distinguish existing partial behavior from the remaining work.
- `API` means an HTTP/domain behavior. `UI` means a browser interaction. `Rule` means a cross-cutting invariant. IDs are stable handles for future test cases.
- The app UI requires sign-in for question, quiz, and attempt pages. The question and quiz **read APIs** also support anonymous access to eligible public or unlisted content.

## Epic 1 — Identity and application access

### Feature: Account and session

- [x] **AUTH-01 · UI** — Sign up with email and password; show an email-confirmation message if no session is returned.
- [x] **AUTH-02 · UI** — Sign in with email and password and go to the question bank.
- [x] **AUTH-03 · UI** — Restore an existing Supabase session after a refresh.
- [x] **AUTH-04 · UI** — Sign out and clear cached application data.
- [x] **AUTH-05 · UI** — Show a sign-in prompt on protected pages when signed out, and a setup message when Auth is unconfigured.
- [x] **AUTH-06 · API** — Verify bearer access tokens, reject invalid/missing tokens on protected routes, and use the Auth user UUID directly.
- [x] **AUTH-07 · API** — Create or load the user's profile during authenticated requests; expose it at `GET /api/v1/me`.
- [ ] **AUTH-08 · UI** — View the profile returned by `/me` or edit profile details in the app. No profile page or edit endpoint exists.

### Feature: App entry and navigation

- [x] **APP-01 · UI** — Open the home page and see API connectivity status.
- [x] **APP-02 · UI** — Navigate among Home, Questions, Quizzes, and Attempts; show a not-found page for unknown routes.
- [x] **APP-03 · UI** — Show loading, empty, error, and retry states on the main list pages.
- [x] **APP-04 · UI** — Use the question and quiz editors with native form controls and client-side schema validation.

## Epic 2 — Question bank

### Feature: Discovery and access

- [x] **QB-01 · API** — List the viewer's questions plus published public questions, newest first, with `limit`/`offset` pagination.
- [x] **QB-02 · API** — Filter the question list by tag slug.
- [x] **QB-03 · API** — Open an owned question or a published public/unlisted question by ID; keep private, draft, and archived content owner-only.
- [x] **QB-04 · UI** — Open `/questions`, browse question cards, and use Previous/Next pagination.
- [x] **QB-05 · UI** — Filter question cards by tag across API pages.
- [x] **QB-06 · UI** — Search prompts and filter by visibility/status on the currently loaded page.
- [ ] **QB-07 · UI/API** — Search and filter prompts, visibility, and status across the entire question bank before pagination.
- [ ] **QB-08 · UI** — Browse public questions without signing in, despite the public read API.
- [ ] **QB-09 · UI** — Filter the bank to only questions created by the current user. The list mixes owned and public questions.

### Feature: Authoring and version history

- [x] **QB-10 · UI/API** — Create a question with an initial immutable version, visibility, and draft/published status.
- [x] **QB-11 · UI** — Author exact-text questions with multiple accepted answers, case sensitivity, whitespace trimming, and an explanation.
- [x] **QB-12 · UI** — Author single-choice questions with options and one correct choice.
- [x] **QB-13 · UI** — Author multiple-choice questions with options and one or more correct choices.
- [x] **QB-14 · API** — Validate question type, answer configuration, and grading configuration together; reject invalid combinations.
- [x] **QB-15 · UI/API** — Revise a question by creating a new immutable content version, then view the owner's version history.
- [x] **QB-16 · Rule** — Keep earlier question versions unchanged and keep existing quizzes pinned to their selected question version.
- [x] **QB-17 · UI/API** — Change question visibility or lifecycle status without creating a content version; archive questions and prevent further revisions while archived.
- [x] **QB-18 · API** — Restrict question revisions, metadata changes, version history, and tag changes to the owner.
- [ ] **QB-19 · UI** — Inspect the full content of an older question version from the history list. The list shows version number, prompt, and date only.
- [ ] **QB-20 · UI/API** — Delete a question. V1 uses archival instead.

## Epic 3 — Tags and organization

### Feature: User-scoped tags

- [x] **TAG-01 · UI/API** — Create a tag from the question bank; list the signed-in user's tags.
- [x] **TAG-02 · API** — Normalize a tag to a slug and reject duplicate slugs for the same owner.
- [x] **TAG-03 · UI/API** — Add or remove an owned tag on an owned question.
- [x] **TAG-04 · UI/API** — Add or remove an owned tag on an owned quiz; create new tags from the question bank first.
- [x] **TAG-05 · Rule** — Keep tags on stable questions/quizzes so tag edits do not create content versions.
- [x] **TAG-06 · API** — Prevent users from assigning another user's tag or tagging another user's content.
- [ ] **TAG-07 · UI/API** — Rename or delete a tag after creation.
- [ ] **TAG-08 · UI** — Create a new tag directly while editing a quiz.

## Epic 4 — Quiz authoring and versioning

### Feature: Quiz creation and editing

- [x] **QUIZ-01 · UI/API** — Create a quiz with title, optional description, settings, questions, visibility, and draft/published status; allow an empty draft.
- [x] **QUIZ-02 · UI** — Pick questions from the bank, search prompts on the loaded page, filter by tag, and page through candidates.
- [x] **QUIZ-03 · UI/API** — Select a specific question version; owners can choose older versions, while another author's available question exposes its current version.
- [x] **QUIZ-04 · UI/API** — Add, remove, replace, and reorder included questions.
- [x] **QUIZ-05 · UI/API** — Set fractional/nonnegative points, required/optional state, and a per-question suggested time value.
- [x] **QUIZ-06 · UI/API** — Configure question shuffling and post-completion answer display.
- [x] **QUIZ-07 · API** — Reject a membership whose question version does not belong to the chosen question, or whose source is not available for use.
- [x] **QUIZ-08 · UI/API** — Save changed attempt-relevant content as a new immutable quiz version, with ordered explicit question-version references.
- [x] **QUIZ-09 · UI/API** — Keep the existing version on an equivalent save; the server is authoritative for no-op detection.
- [x] **QUIZ-10 · Rule** — Changing source question content alone does not update an existing quiz; explicitly selecting its newer version creates a new quiz version.
- [x] **QUIZ-11 · UI/API** — View the owner's quiz version history.
- [x] **QUIZ-12 · API** — Permit previously selected question content to remain in an existing quiz after its source question's visibility changes.
- [ ] **QUIZ-13 · UI** — Inspect or compare the full content of previous quiz versions. The history list shows version number, title, and date only.
- [ ] **QUIZ-14 · UI/API** — Delete a quiz. V1 uses archival instead.

### Feature: Quiz lifecycle and ownership

- [x] **QUIZ-15 · UI/API** — Change quiz visibility among private, unlisted, and public without creating a content version.
- [x] **QUIZ-16 · UI/API** — Change quiz status among draft, published, and archived without creating a content version; block content edits while archived.
- [x] **QUIZ-17 · API** — Reject publication of a quiz with no questions; allow owners to view and edit empty drafts.
- [x] **QUIZ-18 · API** — Restrict quiz edits, metadata changes, tag changes, and version history to the owner.
- [x] **QUIZ-19 · Rule** — Quiz visibility governs attempt access independently of its source questions' bank visibility.

## Epic 5 — Quiz library and discovery

### Feature: Lists, filters, and detail

- [x] **LIB-01 · API** — List owned quizzes and published public quizzes, newest first, with `limit`/`offset` pagination.
- [x] **LIB-02 · API** — Filter the quiz list by tag slug.
- [x] **LIB-03 · UI** — Open `/quizzes` to view available quizzes and use Previous/Next pagination.
- [x] **LIB-04 · UI** — Select “My quizzes” to request an owner-only page and reset pagination.
- [x] **LIB-05 · UI** — Filter by tag through the API; search quiz titles on the loaded page.
- [x] **LIB-06 · UI/API** — View **all** quizzes created by the user as a complete paginated owner-only result set.
- [ ] **LIB-07 · UI/API** — Search titles across the entire library before pagination.
- [ ] **LIB-08 · UI** — Filter the quiz list by lifecycle status or visibility.
- [x] **LIB-09 · API** — Open owned or published public/unlisted quiz details by ID; omit unlisted quizzes from discovery lists and hide private/draft/archived quizzes from non-owners.
- [x] **LIB-10 · UI** — Open quiz details to see title, question count, status, visibility, and start/resume actions; owners see the editor and versions.
- [ ] **LIB-11 · UI** — Browse public quizzes or open an unlisted quiz link while signed out, despite the API's public read support.
- [ ] **LIB-12 · UI** — Generate or copy a shareable unlisted quiz link. A known URL can be used manually after sign-in.

## Epic 6 — Taking a quiz and grading

### Feature: Start and progress

- [x] **TAKE-01 · UI/API** — Start an attempt for a published quiz the user owns or may access by public/unlisted visibility.
- [x] **TAKE-02 · API** — Capture the exact current quiz version, its settings, and immutable question/answer/grading snapshots when starting.
- [x] **TAKE-03 · API** — Shuffle question order for each attempt when the saved quiz setting enables it.
- [x] **TAKE-04 · UI** — Present one question at a time with Previous/Next navigation, position, points, required/optional state, and progress count.
- [x] **TAKE-05 · UI/API** — Submit an exact-text answer and persist it to the user's attempt.
- [x] **TAKE-06 · UI/API** — Submit one selected answer for a single-choice question.
- [x] **TAKE-07 · UI/API** — Submit a set of selected answers for a multiple-choice question.
- [x] **TAKE-08 · API** — Reject answer type mismatches, nonexistent choice IDs, answers to someone else's attempt, and a second answer to an already answered question.
- [x] **TAKE-09 · UI** — Show the saved response but defer score/review until completion; disable the answer form after submission.
- [x] **TAKE-10 · UI/API** — Reload an in-progress attempt at its URL and resume from the first unanswered question.
- [x] **TAKE-11 · UI** — Show saved per-question time as a **suggested** time.
- [ ] **TAKE-12 · UI/API** — Enforce a per-question time limit or automatically expire an attempt. The stored time value is informational today.
- [ ] **TAKE-13 · UI/API** — Abandon an attempt or transition one to expired. Those statuses exist in the contract, but no transition action exists.
- [ ] **TAKE-14 · UI** — Autosave an unsubmitted answer draft before a refresh or navigation; only submitted answers persist.

### Feature: Evaluation and completion

- [x] **GRADE-01 · API** — Grade exact text using the saved accepted answers and case/whitespace settings.
- [x] **GRADE-02 · API** — Grade single choice by the selected correct option.
- [x] **GRADE-03 · API** — Grade multiple choice by an exact set match; no partial credit is awarded.
- [x] **GRADE-04 · API** — Award full configured points for a correct answer and zero for an incorrect answer, including fractional points.
- [x] **GRADE-05 · UI/API** — Complete when every required question has an answer; optional questions may remain blank.
- [x] **GRADE-06 · API** — Sum possible and awarded points from the attempt's recorded questions; an unanswered optional question contributes zero awarded points.
- [x] **GRADE-07 · API** — Reject new submissions or another completion after the attempt is completed.
- [x] **GRADE-08 · Rule** — Preserve the historical score, question text, and evaluation after source question or quiz changes.

## Epic 7 — Results and attempt history

### Feature: Results and review

- [x] **RESULT-01 · UI/API** — Show the completed attempt's quiz title, completion time, total points, and a calculated percentage in the UI.
- [x] **RESULT-02 · UI/API** — Review each presented question, submitted answer, correct/incorrect result, and awarded/possible points.
- [x] **RESULT-03 · UI/API** — Show correct answers and explanations in the attempt response/review only when the saved setting permits them.
- [x] **RESULT-04 · Rule** — The answer-display setting governs practice review, not secrecy: accessible published question/quiz detail APIs may expose answer configuration.
- [x] **RESULT-05 · API** — Restrict attempt detail and results to the user who took the attempt.

### Feature: History and recovery

- [x] **HIST-01 · UI/API** — List only the signed-in user's attempts, newest first, with pagination.
- [x] **HIST-02 · UI** — Resume an in-progress attempt or revisit a completed result from history.
- [x] **HIST-03 · UI** — See recent attempts for a quiz on its detail page, drawn from the first history page.
- [ ] **HIST-04 · UI/API** — Filter attempt history by quiz, status, or date across all pages.
- [ ] **HIST-05 · UI/API** — List all attempts for the current quiz across history pages; the detail panel only checks the first page.

## Epic 8 — Feedback

### Feature: Submit feedback

- [x] **FB-01 · API** — Submit categorized feedback with a comment against exactly one question, quiz, or attempt question.
- [x] **FB-02 · API** — Allow feedback only on owned or accessible published content, or on an attempt question from the submitter's own attempt.
- [x] **FB-03 · UI** — Send feedback about an attempted question during an attempt or from completed review.
- [x] **FB-04 · UI** — Send feedback about a quiz from the completed result page.
- [ ] **FB-05 · UI** — Send feedback directly from a question detail page, although the API supports question feedback.
- [ ] **FB-06 · UI** — Send feedback directly from a quiz landing/detail page before completing an attempt.

### Feature: Review received feedback

- [x] **FB-07 · API** — List feedback on the owner's questions, quizzes, and attempted questions in those quizzes, with pagination.
- [x] **FB-08 · API** — Change received feedback among open, reviewed, resolved, and dismissed; reopening clears the review timestamp.
- [x] **FB-09 · API** — Prevent non-owners from reviewing or changing feedback on someone else's content.
- [ ] **FB-10 · UI** — Open an inbox of received feedback and filter or page through it.
- [ ] **FB-11 · UI** — Mark received feedback reviewed, resolved, dismissed, or open in the app.

## Epic 9 — Cross-cutting API and data behavior

### Feature: Reliability and contracts

- [x] **CORE-01 · API** — Validate request payloads and JSONB domain structures with shared Zod contracts and return standard validation errors.
- [x] **CORE-02 · API** — Use parameterized SQL and transactions for multi-step creation, versioning, and attempt mutations.
- [x] **CORE-03 · API** — Apply database constraints for version uniqueness, question-version membership, and exactly one feedback target.
- [x] **CORE-04 · API** — Generate and validate OpenAPI documentation from the API schemas.
- [x] **CORE-05 · API** — Provide health checks, request IDs, structured logging, and centralized error handling.
- [x] **CORE-06 · UI** — Parse API responses with shared contracts and show action or query errors near the relevant flow.

## Later work outside v1

These are [explicit future extensions](../architecture-plan.md#13-future-core-work), not missing v1 acceptance criteria. Each would need its own use-case breakdown before implementation or automation.

- [ ] **FUTURE-01** — Response revision/history and analytics with separate `user_responses` records.
- [ ] **FUTURE-02** — Regrading, evaluator history, audit trails, and manual grading with separate evaluation records.
- [ ] **FUTURE-03** — Fuzzy/LLM question authoring and rubric-based evaluation, including provider, failure, and cost controls.
- [ ] **FUTURE-04** — Shared workspaces, organizational ownership, collaboration, and moderation.
- [ ] **FUTURE-05** — Public creator profiles, community discovery, and social sharing.
- [ ] **FUTURE-06** — Advanced tags, full-text search, and richer discovery.
- [ ] **FUTURE-07** — Learning analytics, spaced repetition, and review scheduling.
- [ ] **FUTURE-08** — Import/export and bulk question or quiz workflows.
- [ ] **FUTURE-09** — Stronger RLS if clients access application tables directly.

## Using this for automation

Use the IDs as test names or tags. For a complete user flow, cover the checked UI case and its API/rule partner; for access rules, test owner, another signed-in user, and anonymous viewer where applicable. [The test map](use-case-tests.json) links every checked ID to named automated tests. `npm run check:use-cases` verifies that each reference points to a named test and requires both frontend and domain references for `UI/API` rows. It does not judge the assertions or prove that a mocked page test exercises the real HTTP path. Existing suites live in `backend/tests/`, `frontend/src/**/*.test.tsx`, and `frontend/e2e/`.

The repository has browser workflow tests, but the documented local run still requires a Docker-enabled Supabase stack. This inventory was checked against code; it was not a live browser audit.
