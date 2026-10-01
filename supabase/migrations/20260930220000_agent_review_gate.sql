-- Separate machine assignments and decision provenance from the sponsoring owner.
INSERT INTO public.agent_actors (id, code) VALUES
  ('00000000-0000-4000-8000-00000000a002', 'question-reviewer-v1'),
  ('00000000-0000-4000-8000-00000000a003', 'question-reviser-v1'),
  ('00000000-0000-4000-8000-00000000a004', 'publication-gate-v1');

ALTER TABLE public.work_items
  ADD COLUMN assigned_agent_actor_id uuid REFERENCES public.agent_actors (id);
UPDATE public.work_items SET assigned_agent_actor_id = '00000000-0000-4000-8000-00000000a001'
  WHERE item_type = 'CREATE_QUESTION';
CREATE INDEX work_items_agent_queue_idx ON public.work_items
  (assigned_agent_actor_id, status, created_at) WHERE assigned_agent_actor_id IS NOT NULL;

CREATE TABLE public.agent_execution_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_actor_id uuid NOT NULL REFERENCES public.agent_actors (id),
  work_item_id uuid NOT NULL UNIQUE REFERENCES public.work_items (id),
  provider text NOT NULL CHECK (length(trim(provider)) > 0),
  model text NOT NULL CHECK (length(trim(model)) > 0),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER agent_execution_runs_immutable BEFORE UPDATE OR DELETE ON public.agent_execution_runs
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_change();
ALTER TABLE public.agent_execution_runs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.question_review_decisions
  ALTER COLUMN actor_id DROP NOT NULL,
  ADD COLUMN agent_actor_id uuid REFERENCES public.agent_actors (id),
  ADD COLUMN agent_execution_run_id uuid UNIQUE REFERENCES public.agent_execution_runs (id),
  ADD CONSTRAINT question_review_decisions_actor_check CHECK (
    (actor_id IS NOT NULL AND agent_actor_id IS NULL AND agent_execution_run_id IS NULL) OR
    (actor_id IS NULL AND agent_actor_id IS NOT NULL AND agent_execution_run_id IS NOT NULL)
  );
ALTER TABLE public.question_publication_gate_decisions
  ALTER COLUMN actor_id DROP NOT NULL,
  ADD COLUMN agent_actor_id uuid REFERENCES public.agent_actors (id),
  ADD COLUMN agent_execution_run_id uuid UNIQUE REFERENCES public.agent_execution_runs (id),
  ADD CONSTRAINT question_publication_gate_decisions_actor_check CHECK (
    (actor_id IS NOT NULL AND agent_actor_id IS NULL AND agent_execution_run_id IS NULL) OR
    (actor_id IS NULL AND agent_actor_id IS NOT NULL AND agent_execution_run_id IS NOT NULL)
  );
ALTER TABLE public.question_publication_events
  ADD COLUMN agent_actor_id uuid REFERENCES public.agent_actors (id);
