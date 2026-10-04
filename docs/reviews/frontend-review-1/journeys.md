# Current journey maps

These are **implemented paths to inspect**, not proposed flows. Use-case IDs refer to the [current checklist](../../use-cases.md). Review each journey with realistic content and note where a user must infer a status, find a link, or recover from an error.

## 1. Enter and find content

| Step | Current path | Use cases |
| --- | --- | --- |
| Enter | Open `/`; health status appears in the home hero. Follow a header link. Protected content shows a sign-in prompt without a session. | APP-01, APP-02, AUTH-05 |
| Authenticate | Sign in or sign up at `/sign-in`; a returned session routes to `/questions`. | AUTH-01, AUTH-02, AUTH-03 |
| Find a question | Browse `/questions`, filter by tag via the API, or search/filter the current page; open `/questions/$questionId`. | QB-01 through QB-06 |
| Find a quiz | Browse `/quizzes`, choose My quizzes or a tag, search the current page, then open `/quizzes/$quizId`. | LIB-01 through LIB-06, LIB-09, LIB-10 |

**Review boundary:** Public read APIs exist, while these frontend content routes require sign-in (QB-08, LIB-11). Prompt and title searches apply only to the loaded page (QB-07, LIB-07).

## 2. Create and publish a question

| Step | Current path | Use cases |
| --- | --- | --- |
| Create | `/questions` or `/questions/mine` → `/questions/new`; choose exact text, single choice, or multiple choice; save first immutable version as a draft. | QB-10 through QB-14 |
| Manage | Open `/questions/mine/$questionId`; revise content into a new version, change visibility, and assign tags. | QB-15 through QB-18, TAG-03, TAG-05 |
| Approve | An eligible manual question may be directly published. An author can instead submit the exact current version for review. | FLOW-01, FLOW-02, FLOW-05 |
| Review route | `/work-items`: claim content review, decide; approval creates separate publication-gate work. Gate approval publishes the version. | FLOW-06, FLOW-07, FLOW-08 |
| Verify | Return to the owned question and published bank. A newer draft candidate does not replace the bank's published default until publication. | FLOW-01, FLOW-03 |

**Alternate entry:** `/questions/agent` queues a sponsored generation request (FLOW-10, FLOW-11). `/questions/batches` retains a JSON artifact, then materializes private drafts (BATCH-01 through BATCH-07). Agent-origin and imported versions require review before publication (FLOW-12, BATCH-08). A request for changes leads to a new immutable version and another submission (FLOW-09).

## 3. Assemble and maintain a quiz

| Step | Current path | Use cases |
| --- | --- | --- |
| Create | `/quizzes` → `/quizzes/new`; enter title, settings, visibility, and status. A draft may be empty; a published quiz needs questions. | QUIZ-01, QUIZ-06, QUIZ-17 |
| Select | Search/filter the loaded question-picker page, pick an accessible published question and a specific previously published version. | QUIZ-02, QUIZ-03, QUIZ-07 |
| Arrange | Order questions, set points and required state, and enter optional suggested time. Save the first quiz version. | QUIZ-04, QUIZ-05, QUIZ-08 |
| Maintain | `/quizzes/$quizId`: edit attempt-relevant content to create a new version; update visibility, lifecycle, and tags separately. | QUIZ-08 through QUIZ-11, QUIZ-15, QUIZ-16, TAG-04 |

**Review boundary:** The picker can add only eligible published question versions. Saving a newer source-question version does not silently update an existing quiz (QUIZ-10, QUIZ-12). Version history is listed, but full old-version inspection or comparison is not in the UI (QUIZ-13).

## 4. Practice, resume, and review

| Step | Current path | Use cases |
| --- | --- | --- |
| Start | `/quizzes/$quizId` shows settings and a start action for a published quiz. Start creates an attempt from the exact quiz version and snapshots. | TAKE-01 through TAKE-03 |
| Answer | `/attempts/$attemptId` presents one question at a time. Submit a deterministic answer; saved answers cannot be resubmitted. Move with Previous/Next. | TAKE-04 through TAKE-09 |
| Resume | Reopen the attempt URL or use `/attempts`; saved submissions persist and the first unanswered question is selected. | TAKE-10, HIST-01, HIST-02 |
| Complete | Required questions must be answered; optional questions may be blank. Complete to see score and per-question results. | GRADE-05 through GRADE-08, RESULT-01, RESULT-02 |
| Respond | Review correct answers and explanations when the quiz setting allows it; submit feedback on an attempted question or the quiz. | RESULT-03, RESULT-04, FB-03, FB-04 |

**Review boundary:** An unsubmitted answer draft is lost on refresh (TAKE-14). The time value is a suggestion, not an enforced deadline (TAKE-11, TAKE-12). Attempt history is paginated but cannot filter across all pages (HIST-04).
