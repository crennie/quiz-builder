-- Agent identity is separate from a sponsoring human's ownership.
CREATE TABLE public.agent_actors (
  id uuid PRIMARY KEY,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.agent_actors (id, code)
VALUES ('00000000-0000-4000-8000-00000000a001', 'question-generator-v1');

CREATE TABLE public.agent_generation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_actor_id uuid NOT NULL REFERENCES public.agent_actors (id),
  sponsor_id uuid NOT NULL REFERENCES public.profiles (id),
  work_item_id uuid NOT NULL UNIQUE REFERENCES public.work_items (id),
  provider text NOT NULL CHECK (length(trim(provider)) > 0),
  model text NOT NULL CHECK (length(trim(model)) > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.questions
  ADD COLUMN agent_origin_run_id uuid UNIQUE REFERENCES public.agent_generation_runs (id);

ALTER TABLE public.question_versions
  ADD COLUMN agent_run_id uuid UNIQUE REFERENCES public.agent_generation_runs (id);

ALTER TABLE public.work_items
  ADD COLUMN claimed_agent_actor_id uuid REFERENCES public.agent_actors (id);
ALTER TABLE public.work_items DROP CONSTRAINT work_items_claim_check;
ALTER TABLE public.work_items ADD CONSTRAINT work_items_claim_check CHECK (
  (status = 'claimed' AND claim_token IS NOT NULL AND lease_until IS NOT NULL AND (
    (claimed_by IS NOT NULL AND claimed_agent_actor_id IS NULL) OR
    (claimed_by IS NULL AND claimed_agent_actor_id IS NOT NULL)
  )) OR status <> 'claimed'
);

ALTER TABLE public.work_item_events
  ADD COLUMN agent_actor_id uuid REFERENCES public.agent_actors (id),
  ADD CONSTRAINT work_item_events_one_actor_check CHECK (
    actor_id IS NULL OR agent_actor_id IS NULL
  );

CREATE TRIGGER agent_generation_runs_immutable BEFORE UPDATE OR DELETE ON public.agent_generation_runs
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_change();
ALTER TABLE public.agent_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_generation_runs ENABLE ROW LEVEL SECURITY;
