-- Meta Ads Fase B (b2) — RPC de agregação para o dashboard por anúncio.
-- Junta ad_insights (gasto/impressões/cliques/leads-Meta, no período) com a
-- atribuição do lado CRM (leads e negócios ganhos por attribution->>'ad_id').
-- SECURITY DEFINER, scoped à org do auth.uid(); GRANT só a authenticated.
--
-- Janelas: gasto e leads-CRM dentro do período [p_from, p_to]; negócios ganhos
-- e dinheiro efectivo são VIDA do anúncio (a receita realiza-se mais tarde que
-- o gasto, por isso não se filtra por data) — rotular na UI.

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
  currency text
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
      sum(ai.impressions) as impressions,
      sum(ai.clicks) as clicks,
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
    ins.ad_id,
    ins.ad_name,
    ins.campaign_id,
    ins.campaign_name,
    ins.spend,
    ins.impressions,
    ins.clicks,
    ins.meta_leads,
    coalesce(crm_l.n, 0) as crm_leads,
    coalesce(won.won_deals, 0) as won_deals,
    coalesce(won.won_value, 0) as won_value,
    ins.currency
  from ins
  left join crm_l on crm_l.ad_id = ins.ad_id
  left join won on won.ad_id = ins.ad_id
  order by ins.spend desc;
end;
$$;

revoke all on function public.meta_ads_performance(date, date) from public, anon;
grant execute on function public.meta_ads_performance(date, date) to authenticated;
