# Domain model

**Scope:** Business concepts, independent of tables and field lists.

```mermaid
flowchart LR
    author["Author"]
    agent["Question generator"]
    run["Generation run<br/>Machine provenance"]
    batch["Question batch<br/>Retained JSON artifact and digest"]
    batchitem["Batch item<br/>Stable key and first version mapping"]
    learner["Learner"]
    question["Question<br/>Stable identity, visibility, status"]
    qversion["Question version<br/>Immutable content and grading"]
    publication["Publication history<br/>Eligible versions and default"]
    submission["Review submission<br/>Exact version and policy"]
    review["Content review decision"]
    gate["Publication gate decision"]
    work["Work item<br/>Routing, lease, events"]
    quiz["Quiz<br/>Stable identity, visibility, status"]
    version["Quiz version<br/>Immutable attempt content"]
    member["Quiz question<br/>Order, points, exact question version"]
    attempt["Attempt<br/>Learner, quiz version, score"]
    presented["Attempt question<br/>Snapshots, response, evaluation"]
    tag["Tag"]
    feedback["Feedback<br/>Exactly one target"]

    author -->|Owns| question
    author -->|Sponsors| run
    author -->|Uploads| batch
    batch -->|Contains| batchitem
    batchitem -->|Creates private draft| question
    batchitem -->|Records first version| qversion
    agent -->|Executes| run
    run -->|Creates private draft| question
    run -->|Records exact version| qversion
    author -->|Owns| quiz
    author -->|Defines| tag
    question -->|Has| qversion
    question -->|Publishes| publication
    publication -->|Records exact version| qversion
    qversion -->|Submitted as| submission
    submission -->|Decided by| review
    review -->|Approved content awaits| work
    work -->|Routes final decision| gate
    gate -->|May publish| publication
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

Each batch artifact declares a human or external agent source, but its authenticated uploader is the sponsor. Materialization creates all private drafts and immutable key-to-first-version mappings in one transaction. Each imported draft requires an explicit review submission before publication; the declaration alone does not establish trusted worker provenance. Each feedback item targets exactly one of the three shown concepts. A quiz's visibility controls whether it can be attempted; source question visibility controls question-bank access and does not change an existing quiz version. A question can keep an unpublished current candidate while its earlier published default remains in the bank. Any previously published version of an accessible, currently published question can be newly selected for a quiz; a draft version cannot. A submitted candidate has an immutable policy snapshot and distinct content-review and publication-gate decisions. Work items route those decisions and track leases; their status is not a question status. Tags and visibility/status belong to stable identities, so editing them does not create a content version. Question and quiz versions are immutable. Attempts retain their quiz version and frozen settings, question, answer, and grading snapshots. Points may be fractional.

Supported question types are exact text, single choice, and multiple choice. Grading is currently deterministic. Correct answers are practice content, not a secret assessment boundary; review presentation is controlled by quiz settings.
