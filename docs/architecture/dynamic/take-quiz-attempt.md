# Take a quiz attempt

A verified learner can start an owned private or public quiz. The API locks the quiz parent and
rejects an empty composition. Insert the attempt with immutable quiz title and settings, then
snapshot ordered (or shuffled) question identity/content, answer/grading, points, required and timing.
Repeated source questions receive separate attempt-question IDs. Commit the complete snapshot set.

Each answer operation locks the learner's attempt. Require an in-progress attempt, unanswered
attempt-question identity and a valid response type/choice. Evaluate snapshots synchronously and
record response, evaluation and points. Completion locks the same attempt, requires all required
answers, and sums recorded numeric points. Concurrent submissions permit one answer only.

Load and grade exclusively from snapshots. Answers/evaluation are hidden until completion, and
correct answers/explanations obey the saved display setting. History is learner-only. Source edits,
independent replacements and association changes cannot reconstruct or change historical evidence.

The browser player presents one question at a time, with outlined choice cards or a text input.
There is no countdown in the first iteration; snapshot timing does not limit answering. Submitting
advances to the first unanswered question. Previous/Next allow read-only review of saved answers;
all questions must be answered before the player offers final results (the API still requires only
required answers). Failed submissions retain the current input for retry. In-app navigation and
browser unload warn while an attempt is in progress; saved answers can be resumed from history.
