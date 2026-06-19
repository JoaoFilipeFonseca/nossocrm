-- PONTO 1 — Fatia 4: alinhar o score DASH-2 à verdade única.
--
-- Bug: deal_lead_score_signals juntava a etapa por `bs.id::text = d.status`, mas
-- d.status é o ciclo de vida em texto ('open'/'won'/'lost') — nunca casa com um id
-- de etapa. Resultado: stage_order ficava sempre 0 e stagePoints (até 35 pontos do
-- score) NUNCA contribuía. A etapa real está em d.stage_id (mesma correcção já feita
-- em deal_state_signals). Também passa a excluir 'stage_change' dos toques (bookkeeping,
-- coerente com a coluna actor='system').
--
-- Sem novas colunas. CREATE OR REPLACE idempotente.

create or replace function public.deal_lead_score_signals(p_org uuid)
returns table (
  deal_id uuid,
  stage_order integer,
  max_stage_order integer,
  days_since_touch integer,
  touches integer,
  visits integer,
  value numeric,
  snoozed_until date,
  email_opt_out boolean,
  source text
)
language sql
security definer
set search_path to 'public'
as $function$
  with d_today as (
    select (now() at time zone 'Europe/Lisbon')::date as today
  ),
  touch as (
    select
      da.deal_id,
      max(da.created_at) as last_touch,
      count(*)::int as touches,
      count(*) filter (
        where lower(da.type) in ('visit', 'visita', 'meeting', 'reuniao', 'reunião')
      )::int as visits
    from public.deal_activities da
    where da.organization_id = p_org
      and lower(da.type) not in ('stage_moved', 'stage_change', 'created', 'system')
    group by da.deal_id
  ),
  stage_span as (
    select board_id, max("order") as max_order
    from public.board_stages
    where organization_id = p_org
    group by board_id
  )
  select
    d.id as deal_id,
    coalesce(bs."order", 0) as stage_order,
    coalesce(ss.max_order, 0) as max_stage_order,
    case
      when t.last_touch is null then null
      else ((select today from d_today) - t.last_touch::date)
    end as days_since_touch,
    coalesce(t.touches, 0) as touches,
    coalesce(t.visits, 0) as visits,
    d.value,
    case
      when nullif(d.custom_fields->>'snoozedUntil', '') is null then null
      else (d.custom_fields->>'snoozedUntil')::date
    end as snoozed_until,
    coalesce(c.email_opt_out, false) as email_opt_out,
    c.source
  from public.deals d
  -- A etapa real está em d.stage_id (FK), não em d.status ('open'/'won'/'lost').
  left join touch t on t.deal_id = d.id
  left join public.board_stages bs on bs.id = d.stage_id
  left join stage_span ss on ss.board_id = d.board_id
  left join public.contacts c on c.id = d.contact_id
  where d.organization_id = p_org
    and not d.is_won
    and not d.is_lost;
$function$;
