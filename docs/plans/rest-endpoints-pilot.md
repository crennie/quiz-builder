# REST endpoints pilot

**Status:** Batch drafted · **Target:** one ten-question batch · **Topic:** REST endpoints

This is the production ledger for the first topic in the [question bank seeding plan](question-bank-seeding.md). Each row is one distinct learning objective and one single-choice question in the [ten-question pilot artifact](../examples/rest-endpoints-pilot-batch.json). The earlier [five-question example](../examples/rest-endpoints-batch.json) was the starting point. Keep fact-checking references and review decisions here because the retained batch artifact has no fields for them.

## Coverage and tracking

| Item key  | Level        | Learning objective                                                                                                | Fact-checking reference                               | Batch key                              | Question ID | Published version | Review outcome |
| --------- | ------------ | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------- | ----------- | ----------------- | -------------- |
| `rest-01` | Intro        | Identify a resource retrieval request using GET and a resource URI.                                               | [HTTP Semantics §9.3.1][http]                         | `95b4adb5-cc82-48fd-93d6-e2ca0e251040` | Pending     | Pending           | Drafted        |
| `rest-02` | Intro        | Select 201 Created and Location when POST creates a resource with its own URI.                                    | [HTTP Semantics §15.3.2][http]                        | Same                                   | Pending     | Pending           | Drafted        |
| `rest-03` | Intermediate | Distinguish safe methods from idempotent methods and reason about retrying PUT.                                   | [HTTP Semantics §§9.2.1–9.2.2][http]                  | Same                                   | Pending     | Pending           | Drafted        |
| `rest-04` | Intermediate | Choose 405 Method Not Allowed and identify the required Allow response field.                                     | [HTTP Semantics §§10.2.1, 15.5.6][http]               | Same                                   | Pending     | Pending           | Drafted        |
| `rest-05` | Intro        | Explain why a REST request must carry its own application context while the server may still store resources.     | [Fielding, REST §5.1.3][rest]                         | Same                                   | Pending     | Pending           | Drafted        |
| `rest-06` | Intermediate | Choose PUT for replacing a target resource and PATCH for applying partial changes.                                | [HTTP Semantics §9.3.4][http], [HTTP PATCH §2][patch] | Same                                   | Pending     | Pending           | Drafted        |
| `rest-07` | Intermediate | Distinguish Accept, which requests a response representation, from Content-Type, which describes message content. | [HTTP Semantics §§8.3, 12.5.1][http]                  | Same                                   | Pending     | Pending           | Drafted        |
| `rest-08` | Advanced     | Interpret an ETag-based conditional GET with If-None-Match and a 304 response.                                    | [HTTP Semantics §§13.1.2, 15.4.5][http]               | Same                                   | Pending     | Pending           | Drafted        |
| `rest-09` | Advanced     | Use If-Match on an update to avoid overwriting a changed resource and recognize a failed precondition.            | [HTTP Semantics §§13.1.1, 15.5.13][http]              | Same                                   | Pending     | Pending           | Drafted        |
| `rest-10` | Advanced     | Distinguish Cache-Control max-age from no-store when deciding whether a response may be reused.                   | [HTTP Caching §5.2.2][cache]                          | Same                                   | Pending     | Pending           | Drafted        |

The first five item keys match the earlier example. The pilot revises `rest-03` to distinguish method semantics from incidental logging, and `rest-04` to test the required `Allow` field as well as 405. Questions 6–10 are new. `Same` in the batch-key column means the UUID shown for `rest-01`.

## Agreed review rubric

Review the exact question version submitted. Mark each content criterion pass, revise, or reject, and record the decision in the ledger before publication.

1. **Correctness:** The keyed answer and explanation follow the linked primary reference. The scenario includes any assumptions needed to make one answer correct.
2. **Clarity:** A reader can understand the request, resource, and intended result without guessing undocumented API behavior.
3. **Distractors:** Wrong options are plausible for the stated scenario, but each has a specific reason it is wrong. Avoid trivia based only on memorizing a number or header name when the objective calls for reasoning.
4. **Explanation:** Explain why the correct choice works and address the most tempting wrong choice. State protocol requirements precisely, especially when an API convention is merely common practice.
5. **Coverage:** The question tests its assigned objective and does not duplicate another pilot question or an existing bank question.

After the final gate, confirm the approved immutable version is the one published and returned by the bank detail, list, and relevant tag-filter endpoints. Record its question ID and published version here.

Use `Planned`, `Drafted`, `Submitted`, `Revise`, `Rejected`, or `Published` in the review outcome column, with a short reason for `Revise` or `Rejected`. A row counts toward coverage only at `Published`.

[http]: https://www.rfc-editor.org/rfc/rfc9110.html
[patch]: https://www.rfc-editor.org/rfc/rfc5789.html
[cache]: https://www.rfc-editor.org/rfc/rfc9111.html
[rest]: https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm
