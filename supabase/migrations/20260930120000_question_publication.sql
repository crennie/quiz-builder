-- Question publication is separate from the latest candidate version.
ALTER TABLE public.questions
  ADD COLUMN default_published_version_id uuid;

ALTER TABLE public.questions
  ADD CONSTRAINT questions_default_published_version_fkey
  FOREIGN KEY (id, default_published_version_id)
  REFERENCES public.question_versions (question_id, id);

CREATE TABLE public.question_publication_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.questions (id),
  question_version_id uuid,
  actor_id uuid REFERENCES public.profiles (id),
  event_type text NOT NULL CHECK (event_type IN (
    'legacy_published', 'direct_approved', 'published',
    'unpublished', 'archived', 'restored'
  )),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT question_publication_events_version_fkey
    FOREIGN KEY (question_id, question_version_id)
    REFERENCES public.question_versions (question_id, id),
  CONSTRAINT question_publication_events_version_required CHECK (
    event_type IN ('unpublished', 'archived', 'restored') OR question_version_id IS NOT NULL
  )
);

CREATE INDEX question_publication_events_version_idx
  ON public.question_publication_events (question_id, question_version_id, event_type);

CREATE TRIGGER question_publication_events_immutable
  BEFORE UPDATE OR DELETE ON public.question_publication_events
  FOR EACH ROW EXECUTE FUNCTION public.reject_immutable_row_change();

-- Only the current version of a legacy published question has publication evidence.
INSERT INTO public.question_publication_events
  (question_id, question_version_id, event_type)
SELECT id, current_version_id, 'legacy_published'
FROM public.questions
WHERE status = 'published' AND current_version_id IS NOT NULL;

UPDATE public.questions
SET default_published_version_id = current_version_id
WHERE status = 'published';

ALTER TABLE public.questions
  ADD CONSTRAINT questions_publication_status_check CHECK (
    (status <> 'draft' OR default_published_version_id IS NULL) AND
    (status <> 'published' OR default_published_version_id IS NOT NULL)
  );

ALTER TABLE public.question_publication_events ENABLE ROW LEVEL SECURITY;
