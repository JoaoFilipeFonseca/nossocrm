-- CT-1: Card de contacto rico (estilo Notion)
-- Acrescenta um saco flexível de campos (custom_fields) à tabela contacts
-- e cria a relação contacto<->contacto (Indicado por / Indicou).
-- Idempotente: pode correr mais do que uma vez sem efeitos colaterais.

-- 1) Saco de campos flexíveis (Família, Animais, Triggers, DISC, Trimestre,
--    Morada/Investimento, Follow Up, etc.). Evita uma migração por cada campo novo.
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS custom_fields jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) Relação de indicações (referrals) entre contactos da mesma organização.
--    referrer = quem indicou; referred = quem foi indicado.
CREATE TABLE IF NOT EXISTS public.contact_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  referrer_contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  referred_contact_id uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Um contacto não pode indicar-se a si próprio.
  CONSTRAINT contact_referrals_no_self CHECK (referrer_contact_id <> referred_contact_id),
  -- Não duplicar a mesma indicação.
  CONSTRAINT contact_referrals_unique UNIQUE (organization_id, referrer_contact_id, referred_contact_id)
);

CREATE INDEX IF NOT EXISTS contact_referrals_org_idx
  ON public.contact_referrals (organization_id);
CREATE INDEX IF NOT EXISTS contact_referrals_referrer_idx
  ON public.contact_referrals (referrer_contact_id);
CREATE INDEX IF NOT EXISTS contact_referrals_referred_idx
  ON public.contact_referrals (referred_contact_id);

-- 3) RLS por organização (mesmo padrão de contacts: via profiles->auth.uid()).
ALTER TABLE public.contact_referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contact_referrals_org_isolate ON public.contact_referrals;
CREATE POLICY contact_referrals_org_isolate ON public.contact_referrals
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
