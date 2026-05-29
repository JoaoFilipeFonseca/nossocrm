-- Meta Ads Fase B (b2.2) — criativo (imagem/vídeo) por anúncio + RPC actualizada.
-- O criativo é estável por anúncio → tabela própria (não repete por dia).

create table if not exists public.ad_creatives (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  integration_id uuid not null references public.automation_integrations(id) on delete cascade,
  ad_id text not null,
  creative_id text,
  thumbnail_url text,
  image_url text,
  creative_type text,            -- 'image' | 'video' | 'unknown'
  permalink text,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists ad_creatives_unique_ad
  on public.ad_creatives (organization_id, ad_id);

alter table public.ad_creatives enable row level security;

drop policy if exists "org read ad_creatives" on public.ad_creatives;
create policy "org read ad_creatives" on public.ad_creatives
  for select to authenticated
  using (organization_id = (select organization_id from public.profiles where id = auth.uid()));

comment on table public.ad_creatives is 'Meta Ads Fase B b2.2: criativo (miniatura/imagem/tipo) por anúncio. Preenchido pela edge automation-meta-insights.';

-- RPC v3: junta o criativo (thumbnail + tipo) ao desempenho por anúncio.
-- Assinatura muda (novas colunas OUT) → drop antes de recriar.
drop function if exists public.meta_ads_performance(date, date);
create or replace function public.meta_ads_performance(p_from date, p_to date)
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
  thumbnail_url text,
  creative_type text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then return; end if;

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
    where ai.organization_id = v_org
      and ai.date >= p_from and ai.date <= p_to
      and ai.ad_id is not null
    group by ai.ad_id
  ),
  crm_l as (
    select l.attribution->>'ad_id' as ad_id, count(*)::int as n
    from public.leads l
    where l.organization_id = v_org
      and l.attribution->>'ad_id' is not null
      and l.created_at::date >= p_from and l.created_at::date <= p_to
    group by l.attribution->>'ad_id'
  ),
  won as (
    select d.attribution->>'ad_id' as ad_id,
           count(*) filter (where d.is_won)::int as won_deals,
           coalesce(sum(d.value) filter (where d.is_won), 0) as won_value
    from public.deals d
    where d.organization_id = v_org
      and d.attribution->>'ad_id' is not null
    group by d.attribution->>'ad_id'
  )
  select
    ins.ad_id, ins.ad_name, ins.campaign_id, ins.campaign_name, ins.spend,
    ins.impressions, ins.clicks, ins.meta_leads,
    coalesce(crm_l.n, 0), coalesce(won.won_deals, 0), coalesce(won.won_value, 0), ins.currency,
    ac.thumbnail_url, ac.creative_type
  from ins
  left join crm_l on crm_l.ad_id = ins.ad_id
  left join won on won.ad_id = ins.ad_id
  left join public.ad_creatives ac on ac.organization_id = v_org and ac.ad_id = ins.ad_id
  order by ins.spend desc;
end;
$$;
