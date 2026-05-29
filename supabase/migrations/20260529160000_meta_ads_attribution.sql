-- Épico Meta Ads — Fase A, Commit 1 — Atribuição por lead (linhagem de anúncio)
-- ============================================================================
-- Coluna `attribution jsonb` em leads, contacts e deals.
--
-- NÚCLEO do épico: cada lead/contacto/negócio guarda a linhagem do anúncio que
-- o originou e propaga-a até negócio ganho + valor, para medir "qual anúncio
-- deu dinheiro" (CPL, CPA, ROAS, dinheiro efectivo).
--
-- Formato esperado (preenchido pela edge function `automation-meta-leads` no
-- Commit 3 — Fase A — e propagado lead -> contacto -> negócio):
--   {
--     "source": "meta_ads",
--     "platform": "fb" | "ig",
--     "campaign_id": "...", "campaign_name": "...",
--     "adset_id": "...",    "adset_name": "...",
--     "ad_id": "...",       "ad_name": "...",
--     "creative_id": "...",
--     "form_id": "...",     "form_name": "...",
--     "leadgen_id": "...",
--     "captured_at": "2026-05-29T12:00:00Z"
--   }
--
-- Migração idempotente. Não altera RLS: a coluna herda a política org-scoped já
-- existente em cada tabela (leads_org_isolate, contacts/deals org policies).
-- ============================================================================

ALTER TABLE public.leads    ADD COLUMN IF NOT EXISTS attribution jsonb;
ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS attribution jsonb;
ALTER TABLE public.deals    ADD COLUMN IF NOT EXISTS attribution jsonb;

COMMENT ON COLUMN public.leads.attribution    IS 'Linhagem do anúncio (Meta Ads e futuras fontes). Ver migração 20260529160000.';
COMMENT ON COLUMN public.contacts.attribution IS 'Linhagem do anúncio propagada da lead de origem. Ver migração 20260529160000.';
COMMENT ON COLUMN public.deals.attribution    IS 'Linhagem do anúncio propagada do contacto/lead, para medir receita por anúncio. Ver migração 20260529160000.';

-- Índices GIN para consultar por campanha/adset/anúncio (containment @>) na
-- medição da Fase B. Custo nulo agora (tabelas vazias).
CREATE INDEX IF NOT EXISTS leads_attribution_gin    ON public.leads    USING gin (attribution);
CREATE INDEX IF NOT EXISTS contacts_attribution_gin ON public.contacts USING gin (attribution);
CREATE INDEX IF NOT EXISTS deals_attribution_gin    ON public.deals    USING gin (attribution);
