# Domain model

**Scope:** Business concepts, independent of tables and field lists.

```mermaid
flowchart LR
    author["Author"]
    learner["Learner"]
    question["Question<br/>Stable identity, visibility, status"]
    qversion["Question version<br/>Immutable content and grading"]
    quiz["Quiz<br/>Stable identity, visibility, status"]
    version["Quiz version<br/>Immutable attempt content"]
    member["Quiz question<br/>Order, points, exact question version"]
    attempt["Attempt<br/>Learner, quiz version, score"]
    presented["Attempt question<br/>Snapshots, response, evaluation"]
    tag["Tag"]
    feedback["Feedback<br/>Exactly one target"]

    author -->|Owns| question
    author -->|Owns| quiz
    author -->|Defines| tag
    question -->|Has| qversion
    quiz -->|Has| version
    version -->|Orders| member
    member -->|Pins| qversion
    learner -->|Starts| attempt
    attempt -->|Takes| version
    attempt -->|Presents| presented
    presented -->|Originates from| member
    tag -->|Labels| question
    tag -->|Labels| quiz
    feedback -->|May target| question
    feedback -->|May target| quiz
    feedback -->|May target| presented
```

Each feedback item targets exactly one of the three shown concepts. A quiz's visibility controls whether it can be attempted; source question visibility controls question-bank access and does not change an existing quiz version. Tags and visibility/status belong to stable identities, so editing them does not create a content version. Question and quiz versions are immutable. Attempts retain their quiz version and frozen settings, question, answer, and grading snapshots. Points may be fractional.

Supported question types are exact text, single choice, and multiple choice. Grading is currently deterministic. Correct answers are practice content, not a secret assessment boundary; review presentation is controlled by quiz settings.
