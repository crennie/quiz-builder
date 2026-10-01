-- A validated batch artifact is retained before its questions are materialized.
CREATE TABLE public.question_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sponsor_id uuid NOT NULL REFERENCES public.profiles (id),
  batch_key uuid NOT NULL,
  artifact jsonb NOT NULL CHECK (
    jsonb_typeof(artifact) = 'object'
    AND artifact->>'batchKey' IS NOT NULL
    AND lower(artifact->>'batchKey') = batch_key::text
  ),
  artifact_sha256 text NOT NULL CHECK (artifact_sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sponsor_id, batch_key)
);

CREATE TABLE public.question_batch_items (
  batch_id uuid NOT NULL REFERENCES public.question_batches (id),
  item_key text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  question_id uuid NOT NULL REFERENCES public.questions (id),
  question_version_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (batch_id, item_key),
  UNIQUE (batch_id, position),
  UNIQUE (question_id),
  UNIQUE (question_version_id),
  CONSTRAINT question_batch_items_version_fkey
    FOREIGN KEY (question_id, question_version_id)
    REFERENCES public.question_versions (question_id, id)
);

CREATE TRIGGER question_batches_immutable BEFORE UPDATE OR DELETE ON public.question_batches
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_change();
CREATE TRIGGER question_batch_items_immutable BEFORE UPDATE OR DELETE ON public.question_batch_items
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_change();

ALTER TABLE public.question_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_batch_items ENABLE ROW LEVEL SECURITY;
