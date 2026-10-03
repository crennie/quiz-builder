# Screen-state review

This is a **source-based state inventory**. It records visible code paths and questions for a later browser pass; no visual, keyboard, screen-reader, or live API behavior has been verified here. The [frontend pages](../../../frontend/src/pages/) and [global styles](../../../frontend/src/styles.css) are the source for the observations below.

| Screen group | States visible in source | Browser review cases |
| --- | --- | --- |
| Home and authentication | Home shows API pending/connected/unavailable. Protected routes show configuration, session-check, or sign-in states. Sign-in shows busy, Auth error, confirmation message, and signed-in state. | Test each entry point while signed out, with an expired session, and with Auth unconfigured. Check where sign-in returns the user. |
| Question bank and my questions | Loading, query error with retry, filtered empty state, pagination, tag creation error. Prompt, status, and visibility filters run on the current API page. | Check first-use empty bank, a page with no filter matches but more pages available, tag-load failure, and mobile filter layout. |
| Question creation and owned detail | Editor validation and save error; detail loading/unavailable; draft/published/archived actions; review and tag action errors; version list loading/error. | Check a new draft, published question with newer candidate, imported/agent-origin question, archived question, and long prompts/options. Confirm action labels explain candidate versus published content. |
| Batch import and agent request | File size/schema errors, parsed preview, retain/materialize/submit errors; agent request busy/error and redirect to queue. | Check invalid JSON, retained-but-unmaterialized batch, partially viewed long artifact, and review-submitted items. Verify whether progress and completion are clear. |
| Work queue | Loading, query error, empty queue; pending/claimed/failed item controls; action errors and busy state. | Check each review/gate decision, expired claim, failed agent handoff, and narrow screens. Check that the user can distinguish content review from publication approval. |
| Quiz list and editor | List loading/error with retry, filtered empty state, pagination; editor validation/save message and empty question list. Title search runs on the current API page. | Check empty draft, many selected questions, a picker with no eligible questions, long titles, and change/no-change saves. |
| Quiz detail and start | Detail loading/unavailable; owner editing and version history; start busy/error; recent attempts loading/error; unpublished quiz message. | Check owner versus non-owner, published versus draft/archived, inaccessible link, and a quiz with prior attempts beyond the first history page. |
| Attempt and results | Attempt loading/unavailable; in-progress, completed, and non-resumable statuses; saved-answer display, answer/complete errors, progress, and feedback. | Check keyboard navigation, narrow screens, long answer content, refresh before and after submission, optional unanswered questions, and results with answers hidden. |
| Attempt history | Loading/error with retry, no-attempts state, paginated cards, resume/result links. | Check first attempt, mixed statuses, enough items for multiple pages, and a quiz no longer visible in the library. |

## Shared review pass

For each high-traffic screen, capture a desktop and a narrow-viewport view with realistic content. Inspect focus order, visible focus, headings, labels, form errors, and button disabled/busy feedback. The current CSS has a mobile rule at `36rem` for the header and page heading; responsive behavior elsewhere is mostly flexible layout and wrapping, so it needs a browser check rather than an assumption from the stylesheet.

Record findings as: **route + state + steps to reproduce + observed behavior + desired outcome + use-case ID**. Keep observations separate from proposed changes. Start with the journeys in [journeys.md](journeys.md), then add edge cases that those paths expose.
