-- Metas — fonte única. Alarga org_revenue_goals com os alvos do dia a dia do
-- consultor, para deixar de haver metas espalhadas (power list, board, reports).
-- Idempotente.

alter table public.org_revenue_goals
  add column if not exists weekly_conversas integer not null default 25,
  add column if not exists cmi_mes integer not null default 2,
  add column if not exists escrituras_mes integer not null default 1,
  add column if not exists carteira_min integer not null default 5;

comment on column public.org_revenue_goals.weekly_conversas is 'Meta de conversas reais por semana (Power List).';
comment on column public.org_revenue_goals.cmi_mes is 'Meta de CMI assinados por mês (angariações).';
comment on column public.org_revenue_goals.escrituras_mes is 'Meta de escrituras fechadas por mês (compradores).';
comment on column public.org_revenue_goals.carteira_min is 'Nº mínimo de imóveis activos na carteira.';
