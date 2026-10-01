-- Human review is bound to an immutable candidate and a server-chosen policy.
ALTER TABLE public.question_publication_events
  ADD COLUMN policy_snapshot jsonb CHECK (policy_snapshot IS NULL OR jsonb_typeof(policy_snapshot) = 'object');

CREATE TABLE public.question_review_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions (id),
  question_version_id uuid NOT NULL UNIQUE,
  submitted_by uuid NOT NULL REFERENCES public.profiles (id),
  policy_snapshot jsonb NOT NULL CHECK (jsonb_typeof(policy_snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT question_review_submissions_version_fkey
    FOREIGN KEY (question_id, question_version_id)
    REFERENCES public.question_versions (question_id, id)
);

CREATE TABLE public.work_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  queue_name text NOT NULL CHECK (queue_name IN ('question-creation', 'question-review', 'question-revision', 'question-ready-to-publish')),
  item_type text NOT NULL CHECK (item_type IN ('CREATE_QUESTION', 'REVIEW_QUESTION', 'REVISE_QUESTION', 'APPROVE_PUBLICATION')),
  question_id uuid REFERENCES public.questions (id),
  question_version_id uuid,
  submission_id uuid REFERENCES public.question_review_submissions (id),
  assigned_to uuid NOT NULL REFERENCES public.profiles (id),
  input jsonb NOT NULL CHECK (jsonb_typeof(input) = 'object'),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'claimed', 'completed', 'failed', 'cancelled')),
  claim_token uuid,
  claim_generation integer NOT NULL DEFAULT 0 CHECK (claim_generation >= 0),
  claimed_by uuid REFERENCES public.profiles (id),
  lease_until timestamptz,
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts BETWEEN 0 AND 3),
  operation_key text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_items_version_fkey FOREIGN KEY (question_id, question_version_id)
    REFERENCES public.question_versions (question_id, id),
  CONSTRAINT work_items_claim_check CHECK (
    (status = 'claimed' AND claim_token IS NOT NULL AND claimed_by IS NOT NULL AND lease_until IS NOT NULL)
    OR status <> 'claimed'
  ),
  CONSTRAINT work_items_type_queue_check CHECK (
    (item_type = 'CREATE_QUESTION' AND queue_name = 'question-creation') OR
    (item_type = 'REVIEW_QUESTION' AND queue_name = 'question-review') OR
    (item_type = 'REVISE_QUESTION' AND queue_name = 'question-revision') OR
    (item_type = 'APPROVE_PUBLICATION' AND queue_name = 'question-ready-to-publish')
  )
);
CREATE INDEX work_items_assignee_status_idx ON public.work_items (assigned_to, status, created_at);

CREATE TABLE public.question_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL UNIQUE REFERENCES public.question_review_submissions (id),
  work_item_id uuid NOT NULL UNIQUE REFERENCES public.work_items (id),
  actor_id uuid NOT NULL REFERENCES public.profiles (id),
  decision text NOT NULL CHECK (decision IN ('approved', 'changes_requested', 'rejected')),
  findings text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.question_publication_gate_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL UNIQUE REFERENCES public.question_review_submissions (id),
  review_decision_id uuid NOT NULL UNIQUE REFERENCES public.question_review_decisions (id),
  work_item_id uuid NOT NULL UNIQUE REFERENCES public.work_items (id),
  actor_id uuid NOT NULL REFERENCES public.profiles (id),
  decision text NOT NULL CHECK (decision IN ('approve_and_publish', 'changes_requested', 'rejected')),
  findings text NOT NULL DEFAULT '',
  policy_snapshot jsonb NOT NULL CHECK (jsonb_typeof(policy_snapshot) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.work_item_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id uuid NOT NULL REFERENCES public.work_items (id),
  actor_id uuid REFERENCES public.profiles (id),
  event_type text NOT NULL CHECK (event_type IN ('enqueued', 'claimed', 'completed', 'retry', 'failed', 'cancelled')),
  claim_generation integer NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER question_review_submissions_immutable BEFORE UPDATE OR DELETE ON public.question_review_submissions
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_change();
CREATE TRIGGER question_review_decisions_immutable BEFORE UPDATE OR DELETE ON public.question_review_decisions
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_change();
CREATE TRIGGER question_publication_gate_decisions_immutable BEFORE UPDATE OR DELETE ON public.question_publication_gate_decisions
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_change();
CREATE TRIGGER work_item_events_immutable BEFORE UPDATE OR DELETE ON public.work_item_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_change();

ALTER TABLE public.question_review_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_review_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_publication_gate_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_item_events ENABLE ROW LEVEL SECURITY;
