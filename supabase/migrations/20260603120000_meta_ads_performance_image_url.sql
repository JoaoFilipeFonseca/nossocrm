-- MA-LIGHTBOX-FULL: RPC meta_ads_performance devolve image_url (imagem cheia do criativo)
-- para o lightbox do /anuncios abrir em grande, com recurso ao thumbnail quando não há.
-- Drop necessário por mudar o tipo de retorno. Grants limpos (authenticated + service_role).
drop function if exists public.meta_ads_performance(date, date);

create function public.meta_ads_performance(p_from date, p_to date)
returns table(
  ad_id text, ad_name text, campaign_id text, campaign_name text,
  adset_id text, adset_name text,
  spend numeric, impressions bigint, clicks bigint, meta_leads integer,
  crm_leads integer, won_deals integer, won_value numeric, currency text,
  thumbnail_url text, image_url text, creative_type text
)
language plpgsql security definer set search_path to ''
as $function$
declare v_org uuid;
begin
  select organization_id into v_org from public.profiles where id = auth.uid();
  if v_org is null then return; end if;
  return query
  with ins as (
    select ai.ad_id, max(ai.ad_name) ad_name, max(ai.campaign_id) campaign_id,
      max(ai.campaign_name) campaign_name,
      max(ai.adset_id) adset_id, max(ai.adset_name) adset_name,
      sum(ai.spend) spend,
      sum(ai.impressions)::bigint impressions, sum(ai.clicks)::bigint clicks,
      sum(ai.leads)::int meta_leads, max(ai.currency) currency
    from public.ad_insights ai
    where ai.organization_id = v_org and ai.date >= p_from and ai.date <= p_to and ai.ad_id is not null
    group by ai.ad_id
  ),
  crm_l as (
    select l.attribution->>'ad_id' ad_id, count(*)::int n
    from public.leads l
    where l.organization_id = v_org and l.attribution->>'ad_id' is not null
      and l.created_at::date >= p_from and l.created_at::date <= p_to
    group by l.attribution->>'ad_id'
  ),
  won as (
    select d.attribution->>'ad_id' ad_id,
      count(*) filter (where d.is_won)::int won_deals,
      coalesce(sum(d.value) filter (where d.is_won),0) won_value
    from public.deals d
    where d.organization_id = v_org and d.attribution->>'ad_id' is not null
    group by d.attribution->>'ad_id'
  )
  select ins.ad_id, ins.ad_name, ins.campaign_id, ins.campaign_name,
    ins.adset_id, ins.adset_name, ins.spend,
    ins.impressions, ins.clicks, ins.meta_leads,
    coalesce(crm_l.n,0), coalesce(won.won_deals,0), coalesce(won.won_value,0), ins.currency,
    ac.thumbnail_url, ac.image_url, ac.creative_type
  from ins
  left join crm_l on crm_l.ad_id = ins.ad_id
  left join won on won.ad_id = ins.ad_id
  left join public.ad_creatives ac on ac.organization_id = v_org and ac.ad_id = ins.ad_id
  order by ins.spend desc;
end;
$function$;

revoke all on function public.meta_ads_performance(date, date) from public;
grant execute on function public.meta_ads_performance(date, date) to authenticated, service_role;
