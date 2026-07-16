-- Linhagem de negócios (fundação MA-LTV): um negócio pode derivar de outro
-- (indicação numa visita, investidor que compra mais, arrendamentos gerados
-- durante uma pesquisa, etc.). Permite ligar e medir o valor total que um
-- negócio original gerou ao longo do tempo.
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS origin_deal_id UUID REFERENCES public.deals(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_deals_origin_deal_id ON public.deals(origin_deal_id) WHERE origin_deal_id IS NOT NULL;
COMMENT ON COLUMN public.deals.origin_deal_id IS 'Negócio do qual este derivou (linhagem). NULL = negócio raiz.';
