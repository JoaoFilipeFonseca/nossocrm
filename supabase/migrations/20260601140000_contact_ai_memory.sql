-- CONTACT-360-AI Fase 3: memória/aprendizagem. Idempotente.

CREATE TABLE IF NOT EXISTS public.contact_ai_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  result jsonb NOT NULL,
  model text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_ai_analyses_contact_idx ON public.contact_ai_analyses (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contact_ai_analyses_org_idx ON public.contact_ai_analyses (organization_id);
ALTER TABLE public.contact_ai_analyses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contact_ai_analyses_org_isolate ON public.contact_ai_analyses;
CREATE POLICY contact_ai_analyses_org_isolate ON public.contact_ai_analyses
  FOR ALL
  USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())))
  WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));

CREATE TABLE IF NOT EXISTS public.contact_ai_suggestion_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  campo text NOT NULL,
  valor text NOT NULL,
  action text NOT NULL CHECK (action IN ('accepted','ignored')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_ai_sugg_events_contact_idx ON public.contact_ai_suggestion_events (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contact_ai_sugg_events_org_idx ON public.contact_ai_suggestion_events (organization_id);
ALTER TABLE public.contact_ai_suggestion_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS contact_ai_sugg_events_org_isolate ON public.contact_ai_suggestion_events;
CREATE POLICY contact_ai_sugg_events_org_isolate ON public.contact_ai_suggestion_events
  FOR ALL
  USING (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())))
  WITH CHECK (organization_id = (SELECT p.organization_id FROM public.profiles p WHERE p.id = (SELECT auth.uid())));
