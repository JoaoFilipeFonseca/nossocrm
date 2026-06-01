-- CT-1 Fase 3: comentários no contacto (ficha /contacts/[id]).
-- Idempotente.

CREATE TABLE IF NOT EXISTS public.contact_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contact_comments_contact_idx
  ON public.contact_comments (contact_id, created_at DESC);
CREATE INDEX IF NOT EXISTS contact_comments_org_idx
  ON public.contact_comments (organization_id);

ALTER TABLE public.contact_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_comments_org_isolate ON public.contact_comments;
CREATE POLICY contact_comments_org_isolate ON public.contact_comments
  FOR ALL
  USING (
    organization_id = (
      SELECT p.organization_id FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    organization_id = (
      SELECT p.organization_id FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
    )
  );
