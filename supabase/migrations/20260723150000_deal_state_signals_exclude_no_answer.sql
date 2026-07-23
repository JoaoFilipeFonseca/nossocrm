-- F5 — Verdade única do relógio de conversa (decisão do João 23/07/2026):
-- Uma chamada "não atendida" CONTA como contacto manual (human_touches segue a
-- contar tudo), MAS a lead ainda não foi atendida — o relógio do pipeline
-- continua a andar. Por isso `last_human_touch` (que zera o relógio de frieza e
-- alimenta days_since_human_touch / days_idle / status) passa a EXCLUIR toques com
-- result ∈ (no_answer, voicemail).
--
-- Única alteração face à versão anterior: o filtro do last_human_touch no CTE touch.

create or replace function public.deal_state_signals(p_org uuid)
returns table(
  deal_id uuid, board_id uuid, board_name text, stage_order integer, max_stage_order integer,
  is_holding boolean, last_human_touch timestamp with time zone, last_automation_touch timestamp with time zone,
  days_since_human_touch integer, days_idle integer, human_touches integer, automation_touches integer,
  visits integer, open_tasks integer, overdue_tasks integer, snoozed_until date, value numeric, status text)
language sql
security definer
set search_path to 'public'
as $function$
  with d_today as (select (now() at time zone 'Europe/Lisbon')::date as today),
  touch as (
    select da.deal_id,
      max(da.created_at) filter (
        where da.actor = 'human'
          and coalesce(da.metadata->>'result','') not in ('no_answer','voicemail')
      ) as last_human_touch,
      max(da.created_at) filter (where da.actor = 'automation') as last_automation_touch,
      count(*) filter (where da.actor = 'human')::int as human_touches,
      count(*) filter (where da.actor = 'automation')::int as automation_touches,
      count(*) filter (where da.actor = 'human' and lower(da.type) in ('visit','visita','meeting','reuniao','reunião'))::int as visits
    from public.deal_activities da
    where da.organization_id = p_org and lower(da.type) not in ('stage_moved','stage_change','created','system')
    group by da.deal_id
  ),
  tasks as (
    select a.deal_id, count(*)::int as open_tasks,
      count(*) filter (where a.date::date < (select today from d_today))::int as overdue_tasks
    from public.activities a
    where a.organization_id = p_org and not a.completed and a.deleted_at is null and a.deal_id is not null
    group by a.deal_id
  ),
  stage_span as (
    select board_id, max("order") as max_order from public.board_stages where organization_id = p_org group by board_id
  )
  select d.id as deal_id, d.board_id, b.name as board_name,
    coalesce(bs."order", 0) as stage_order, coalesce(ss.max_order, 0) as max_stage_order,
    coalesce(bs.excludes_followup, false) as is_holding,
    t.last_human_touch, t.last_automation_touch,
    case when t.last_human_touch is null then null else ((select today from d_today) - t.last_human_touch::date) end as days_since_human_touch,
    ((select today from d_today) - coalesce(t.last_human_touch, d.created_at)::date) as days_idle,
    coalesce(t.human_touches,0) as human_touches, coalesce(t.automation_touches,0) as automation_touches,
    coalesce(t.visits,0) as visits, coalesce(tk.open_tasks,0) as open_tasks, coalesce(tk.overdue_tasks,0) as overdue_tasks,
    case when nullif(d.custom_fields->>'snoozedUntil','') is null then null else (d.custom_fields->>'snoozedUntil')::date end as snoozed_until,
    d.value,
    case
      when nullif(d.custom_fields->>'snoozedUntil','') is not null and (d.custom_fields->>'snoozedUntil')::date >= (select today from d_today) then 'adiado'
      when coalesce(bs.excludes_followup,false) and t.last_human_touch is null then 'por_trabalhar'
      when ((select today from d_today) - coalesce(t.last_human_touch, d.created_at)::date) <= 7 then 'activo'
      when ((select today from d_today) - coalesce(t.last_human_touch, d.created_at)::date) <= 30 then 'arrefecer'
      else 'parado'
    end as status
  from public.deals d
  join public.boards b on b.id = d.board_id
  left join touch t on t.deal_id = d.id
  left join tasks tk on tk.deal_id = d.id
  left join public.board_stages bs on bs.id = d.stage_id
  left join stage_span ss on ss.board_id = d.board_id
  where d.organization_id = p_org and not d.is_won and not d.is_lost;
$function$;
