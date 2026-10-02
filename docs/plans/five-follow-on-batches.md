# Five follow-on question batches

**Status:** Drafted locally. These artifacts have not been retained or materialized.

Each batch uses the [agreed review rubric](rest-endpoints-pilot.md#agreed-review-rubric). References and learning objectives stay in this ledger because the immutable batch schema has no fields for them. `Question ID` and `Published version` remain pending until the workflow produces them. A row counts toward coverage only after publication.

## React

Artifact: [react-batch.json](../examples/react-batch.json) · Batch key: `a5c2e768-cbea-4fc1-8d1b-1c6fbdc9eee8`

| Item key   | Level        | Learning objective                                                         | Fact-checking source                                                    | Question ID | Published version | Review outcome |
| ---------- | ------------ | -------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------- | ----------------- | -------------- |
| `react-01` | Intro        | Choose stable list keys when items can reorder.                            | [Reference](https://react.dev/learn/rendering-lists)                    | Pending     | Pending           | Drafted        |
| `react-02` | Intermediate | Use updater functions when successive state changes depend on prior state. | [Reference](https://react.dev/learn/queueing-a-series-of-state-updates) | Pending     | Pending           | Drafted        |
| `react-03` | Intro        | Identify the state and event handler needed for a controlled text input.   | [Reference](https://react.dev/reference/react-dom/components/input)     | Pending     | Pending           | Drafted        |
| `react-04` | Intermediate | Lift shared state to the closest common parent.                            | [Reference](https://react.dev/learn/sharing-state-between-components)   | Pending     | Pending           | Drafted        |
| `react-05` | Intermediate | Choose an Effect for synchronizing with an external system.                | [Reference](https://react.dev/learn/synchronizing-with-effects)         | Pending     | Pending           | Drafted        |
| `react-06` | Intermediate | Clean up an Effect subscription when its dependency changes.               | [Reference](https://react.dev/learn/synchronizing-with-effects)         | Pending     | Pending           | Drafted        |
| `react-07` | Advanced     | Reset component state intentionally by changing its key.                   | [Reference](https://react.dev/learn/preserving-and-resetting-state)     | Pending     | Pending           | Drafted        |
| `react-08` | Advanced     | Recognize the limits of React memoization.                                 | [Reference](https://react.dev/reference/react/memo)                     | Pending     | Pending           | Drafted        |
| `react-09` | Intro        | Distinguish refs from state for rendering updates.                         | [Reference](https://react.dev/reference/react/useRef)                   | Pending     | Pending           | Drafted        |
| `react-10` | Advanced     | Apply the top-level Rules of Hooks.                                        | [Reference](https://react.dev/reference/rules/rules-of-hooks)           | Pending     | Pending           | Drafted        |

## Modern JavaScript

Artifact: [modern-javascript-batch.json](../examples/modern-javascript-batch.json) · Batch key: `0dc768bd-e845-456b-81d1-d8d77f9fe392`

| Item key | Level        | Learning objective                                              | Fact-checking source                  | Question ID | Published version | Review outcome |
| -------- | ------------ | --------------------------------------------------------------- | ------------------------------------- | ----------- | ----------------- | -------------- |
| `js-01`  | Intro        | Distinguish a const binding from the mutability of its object.  | [Reference](https://tc39.es/ecma262/) | Pending     | Pending           | Drafted        |
| `js-02`  | Intro        | Predict optional chaining on a nullish base.                    | [Reference](https://tc39.es/ecma262/) | Pending     | Pending           | Drafted        |
| `js-03`  | Intro        | Distinguish nullish coalescing from logical OR for zero.        | [Reference](https://tc39.es/ecma262/) | Pending     | Pending           | Drafted        |
| `js-04`  | Intermediate | Recognize when a destructuring default applies.                 | [Reference](https://tc39.es/ecma262/) | Pending     | Pending           | Drafted        |
| `js-05`  | Intermediate | Understand Promise.all rejection without assuming cancellation. | [Reference](https://tc39.es/ecma262/) | Pending     | Pending           | Drafted        |
| `js-06`  | Intermediate | Recognize that an async function returns a promise.             | [Reference](https://tc39.es/ecma262/) | Pending     | Pending           | Drafted        |
| `js-07`  | Intermediate | Use toSorted without mutating the source array.                 | [Reference](https://tc39.es/ecma262/) | Pending     | Pending           | Drafted        |
| `js-08`  | Advanced     | Test whether an object owns a property.                         | [Reference](https://tc39.es/ecma262/) | Pending     | Pending           | Drafted        |
| `js-09`  | Advanced     | Recognize object identity as a Map key.                         | [Reference](https://tc39.es/ecma262/) | Pending     | Pending           | Drafted        |
| `js-10`  | Advanced     | Recognize live imported module bindings.                        | [Reference](https://tc39.es/ecma262/) | Pending     | Pending           | Drafted        |

## Modern CSS

Artifact: [modern-css-batch.json](../examples/modern-css-batch.json) · Batch key: `87363545-1b5a-408c-9f7a-a07e3fc7d2d9`

| Item key | Level        | Learning objective                                              | Fact-checking source                                  | Question ID | Published version | Review outcome |
| -------- | ------------ | --------------------------------------------------------------- | ----------------------------------------------------- | ----------- | ----------------- | -------------- |
| `css-01` | Intro        | Choose Grid for a two-dimensional layout.                       | [Reference](https://www.w3.org/TR/css-grid-2/)        | Pending     | Pending           | Drafted        |
| `css-02` | Intro        | Use a custom-property fallback when the property is absent.     | [Reference](https://www.w3.org/TR/css-variables-1/)   | Pending     | Pending           | Drafted        |
| `css-03` | Intermediate | Interpret clamp as a bounded preferred value.                   | [Reference](https://www.w3.org/TR/css-values-4/)      | Pending     | Pending           | Drafted        |
| `css-04` | Advanced     | Apply normal cascade-layer order before specificity.            | [Reference](https://www.w3.org/TR/css-cascade-5/)     | Pending     | Pending           | Drafted        |
| `css-05` | Intermediate | Recognize the zero specificity of :where().                     | [Reference](https://www.w3.org/TR/selectors-4/)       | Pending     | Pending           | Drafted        |
| `css-06` | Intermediate | Distinguish container size queries from viewport media queries. | [Reference](https://www.w3.org/TR/css-conditional-5/) | Pending     | Pending           | Drafted        |
| `css-07` | Intermediate | Use logical inline properties across text directions.           | [Reference](https://www.w3.org/TR/css-logical-1/)     | Pending     | Pending           | Drafted        |
| `css-08` | Intro        | Use @supports to condition styles on CSS feature support.       | [Reference](https://www.w3.org/TR/css-conditional-3/) | Pending     | Pending           | Drafted        |
| `css-09` | Advanced     | Respect the reduced-motion user preference.                     | [Reference](https://www.w3.org/TR/mediaqueries-5/)    | Pending     | Pending           | Drafted        |
| `css-10` | Advanced     | Interpret the nesting selector in a nested rule.                | [Reference](https://www.w3.org/TR/css-nesting-1/)     | Pending     | Pending           | Drafted        |

## Serving a modern web application

Artifact: [serving-web-app-batch.json](../examples/serving-web-app-batch.json) · Batch key: `a7303503-13f7-47a4-8b5e-ee69e07d05f7`

| Item key   | Level        | Learning objective                                                              | Fact-checking source                                                    | Question ID | Published version | Review outcome |
| ---------- | ------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------- | ----------------- | -------------- |
| `serve-01` | Intro        | Serve the production build rather than the development server.                  | [Reference](https://vite.dev/guide/build.html)                          | Pending     | Pending           | Drafted        |
| `serve-02` | Intermediate | Route client-side navigation URLs to the SPA shell while preserving asset 404s. | [Reference](https://vite.dev/guide/static-deploy.html)                  | Pending     | Pending           | Drafted        |
| `serve-03` | Intermediate | Cache content-hashed assets for a long freshness lifetime.                      | [Reference](https://www.rfc-editor.org/rfc/rfc8246.html)                | Pending     | Pending           | Drafted        |
| `serve-04` | Intermediate | Revalidate an HTML entry point that references versioned assets.                | [Reference](https://www.rfc-editor.org/rfc/rfc9111.html)                | Pending     | Pending           | Drafted        |
| `serve-05` | Intro        | Distinguish compression negotiation from the actual response encoding.          | [Reference](https://www.rfc-editor.org/rfc/rfc9110.html)                | Pending     | Pending           | Drafted        |
| `serve-06` | Advanced     | Use Vary when a cache stores encoded variants.                                  | [Reference](https://www.rfc-editor.org/rfc/rfc9111.html)                | Pending     | Pending           | Drafted        |
| `serve-07` | Intro        | Understand what HTTPS protects at the TLS boundary.                             | [Reference](https://www.rfc-editor.org/rfc/rfc8446.html)                | Pending     | Pending           | Drafted        |
| `serve-08` | Advanced     | Recognize a CORS preflight for a cross-origin JSON request.                     | [Reference](https://fetch.spec.whatwg.org/)                             | Pending     | Pending           | Drafted        |
| `serve-09` | Advanced     | Distinguish readiness from liveness in a service deployment.                    | [Reference](https://kubernetes.io/docs/concepts/workloads/pods/probes/) | Pending     | Pending           | Drafted        |
| `serve-10` | Intermediate | Report temporary service unavailability with retry guidance.                    | [Reference](https://www.rfc-editor.org/rfc/rfc9110.html)                | Pending     | Pending           | Drafted        |

## Music theory: diatonic

Artifact: [diatonic-music-theory-batch.json](../examples/diatonic-music-theory-batch.json) · Batch key: `17b3c600-8d6c-4610-b771-26aecb746403`

| Item key   | Level        | Learning objective                                               | Fact-checking source                                              | Question ID | Published version | Review outcome |
| ---------- | ------------ | ---------------------------------------------------------------- | ----------------------------------------------------------------- | ----------- | ----------------- | -------------- |
| `music-01` | Intro        | Recall the whole-step and half-step pattern of a major scale.    | [Reference](https://openmusictheory.github.io/scales.html)        | Pending     | Pending           | Drafted        |
| `music-02` | Intro        | Apply a major-key signature to name its scale notes.             | [Reference](https://openmusictheory.github.io/keySignatures.html) | Pending     | Pending           | Drafted        |
| `music-03` | Intro        | Identify the relative minor of a major key.                      | [Reference](https://openmusictheory.github.io/keySignatures.html) | Pending     | Pending           | Drafted        |
| `music-04` | Intermediate | Identify the leading tone in a major key.                        | [Reference](https://openmusictheory.github.io/scales.html)        | Pending     | Pending           | Drafted        |
| `music-05` | Intermediate | Build the diatonic supertonic triad in a major key.              | [Reference](https://openmusictheory.github.io/triads.html)        | Pending     | Pending           | Drafted        |
| `music-06` | Intermediate | Build the dominant triad of a major key.                         | [Reference](https://openmusictheory.github.io/triads.html)        | Pending     | Pending           | Drafted        |
| `music-07` | Advanced     | Distinguish the natural-minor dominant from an altered dominant. | [Reference](https://openmusictheory.github.io/scales.html)        | Pending     | Pending           | Drafted        |
| `music-08` | Advanced     | Build a diatonic dominant seventh chord.                         | [Reference](https://openmusictheory.github.io/triads.html)        | Pending     | Pending           | Drafted        |
| `music-09` | Advanced     | Recognize the diatonic leading-tone seventh chord in major.      | [Reference](https://openmusictheory.github.io/triads.html)        | Pending     | Pending           | Drafted        |
| `music-10` | Intermediate | Recognize a dominant-to-tonic authentic cadence.                 | [Reference](https://openmusictheory.github.io/cadenceTypes)       | Pending     | Pending           | Drafted        |
