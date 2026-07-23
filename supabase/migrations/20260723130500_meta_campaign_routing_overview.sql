-- MA-ROUTING-UX — visão agregada por campanha para o painel de encaminhamento.
-- Devolve, por campanha da org: nome, destino actual (board/stage), última data
-- com entrega/gasto (sinal de "activa"), última lead atribuída e flag de arquivo.
-- Feito em SQL (sem limite de 1000 linhas do PostgREST) e chamado pelo route admin
-- (service role) que já validou admin+org — por isso recebe p_org por parâmetro.

create or replace function public.meta_campaign_routing_overview(
  p_org uuid,
  p_window_days int default 7
)
returns table (
  campaign_id text,
  campaign_name text,
  board_id uuid,
  stage_id uuid,
  last_active_date date,
  active boolean,
  last_lead_at timestamptz,
  archived_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with camp as (
    select ai.campaign_id,
           max(ai.campaign_name) as campaign_name,
           max(ai.date) filter (where ai.spend > 0 or ai.impressions > 0) as last_active_date
    from public.ad_insights ai
    where ai.organization_id = p_org and ai.campaign_id is not null
    group by ai.campaign_id
  ),
  leads as (
    select c.attribution->>'campaign_id' as campaign_id, max(c.created_at) as last_lead_at
    from public.contacts c
    where c.organization_id = p_org and c.attribution ? 'campaign_id'
    group by c.attribution->>'campaign_id'
  )
  select camp.campaign_id,
         camp.campaign_name,
         r.board_id,
         r.stage_id,
         camp.last_active_date,
         (camp.last_active_date is not null and camp.last_active_date >= (current_date - p_window_days)) as active,
         leads.last_lead_at,
         a.archived_at
  from camp
  left join public.meta_lead_routing r on r.organization_id = p_org and r.campaign_id = camp.campaign_id
  left join leads on leads.campaign_id = camp.campaign_id
  left join public.meta_campaign_archive a on a.organization_id = p_org and a.campaign_id = camp.campaign_id;
$$;

revoke all on function public.meta_campaign_routing_overview(uuid, int) from public, authenticated, anon;
