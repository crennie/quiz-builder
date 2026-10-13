# ADR-002: API authorization boundary

Status: accepted, revised for direct V1 content by ADR-009.

Express verifies Supabase Auth access tokens and owns domain access. Profile UUIDs are Auth user
UUIDs. RLS is enabled on application tables with no browser Data API policies.
Owner/public question and quiz reads are allowed; personal lists are owner-only. Ordinary content
creation is private and content mutations require owned private records with no use lock. Tags
require owned entities and owner-scoped tags. Public creation/promotion/editing has no ordinary API.
Learners access only their own attempts. Sponsored batches stay sponsor-only. Attempted-question
feedback can be reviewed by the quiz owner and source-question owner; submitting it requires the
learner's own attempt. Courses/lessons are public read-only content. Supplied invalid tokens fail.
SQL triggers enforce content locks and relationship integrity independently of API ownership checks.
