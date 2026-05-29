-- Meta Ads Fase B (b2.3) — analista IA: armazenamento das análises diárias +
-- RPC admin (usada pelo cron, sem auth.uid) que devolve o desempenho por anúncio
-- com days_with_data (dias com dados, para a cadência de decisão 3/5/8).

create table if not exists public.ad_analyses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  integration_id uuid,
  analyzed_at date not null,
  ad_id text not null,
  ad_name text,
  verdict text not null,                 -- parar | aumentar | testar | manter
  confidence numeric(4,3),               -- 0..1, sobe com days_with_data
  reason text,
  suggestion text,
  impact_eur numeric(14,2),
  is_anomaly boolean not null default false,
  days_with_data integer,
  metrics jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists ad_analyses_unique_ad_day
  on public.ad_analyses (organization_id, ad_id, analyzed_at);
create index if not exists ad_analyses_org_day
  on public.ad_analyses (organization_id, analyzed_at desc);

alter table public.ad_analyses enable row level security;
drop policy if exists "org read ad_analyses" on public.ad_analyses;
create policy "org read ad_analyses" on public.ad_analyses
  for select to authenticated
  using (organization_id = (select organization_id from public.profiles where id = auth.uid()));

comment on table public.ad_analyses is 'Meta Ads Fase B b2.3: veredictos diários do analista IA por anúncio (parar/aumentar/testar/manter) + anomalias.';

-- RPC admin: igual ao meta_ads_performance mas recebe a org por parâmetro
-- (o cron corre como service_role, sem auth.uid). + days_with_data por anúncio.
create or replace function public.meta_ads_performance_admin(p_org uuid, p_from date, p_to date)
returns table (
  ad_id text,
  ad_name text,
  campaign_id text,
  campaign_name text,
  spend numeric,
  impressions bigint,
  clicks bigint,
  meta_leads integer,
  crm_leads integer,
  won_deals integer,
  won_value numeric,
  currency text,
  days_with_data integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with ins as (
    select
      ai.ad_id,
      max(ai.ad_name) as ad_name,
      max(ai.campaign_id) as campaign_id,
      max(ai.campaign_name) as campaign_name,
      sum(ai.spend) as spend,
      sum(ai.impressions)::bigint as impressions,
      sum(ai.clicks)::bigint as clicks,
      sum(ai.leads)::int as meta_leads,
      max(ai.currency) as currency
    from public.ad_insights ai
    where ai.organization_id = p_org
      and ai.date >= p_from and ai.date <= p_to
      and ai.ad_id is not null
    group by ai.ad_id
  ),
  life as (
    -- dias com dados ao longo da VIDA do anúncio (não só no período).
    select ai.ad_id, count(distinct ai.date)::int as days_with_data
    from public.ad_insights ai
    where ai.organization_id = p_org and ai.ad_id is not null
    group by ai.ad_id
  ),
  crm_l as (
    select l.attribution->>'ad_id' as ad_id, count(*)::int as n
    from public.leads l
    where l.organization_id = p_org
      and l.attribution->>'ad_id' is not null
      and l.created_at::date >= p_from and l.created_at::date <= p_to
    group by l.attribution->>'ad_id'
  ),
  won as (
    select d.attribution->>'ad_id' as ad_id,
           count(*) filter (where d.is_won)::int as won_deals,
           coalesce(sum(d.value) filter (where d.is_won), 0) as won_value
    from public.deals d
    where d.organization_id = p_org
      and d.attribution->>'ad_id' is not null
    group by d.attribution->>'ad_id'
  )
  select
    ins.ad_id, ins.ad_name, ins.campaign_id, ins.campaign_name, ins.spend,
    ins.impressions, ins.clicks, ins.meta_leads,
    coalesce(crm_l.n, 0), coalesce(won.won_deals, 0), coalesce(won.won_value, 0), ins.currency,
    coalesce(life.days_with_data, 0)
  from ins
  left join life on life.ad_id = ins.ad_id
  left join crm_l on crm_l.ad_id = ins.ad_id
  left join won on won.ad_id = ins.ad_id
  order by ins.spend desc;
end;
$$;

revoke all on function public.meta_ads_performance_admin(uuid, date, date) from public, anon, authenticated;
grant execute on function public.meta_ads_performance_admin(uuid, date, date) to service_role;
