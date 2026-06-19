-- PONTO 1 (Verdade Única do estado) — Fatia 1: fundação de dados.
--
-- Problema: o Inbox decidia "parado/risco" por deals.updated_at (que mente — mover
-- por SQL/automação não o bumpa; edições de campos bumpam-no sem ter havido toque),
-- enquanto o motor de follow-up e o score já usam o último TOQUE real em deal_activities.
--
-- Esta migração cria UMA fonte de verdade:
--   1. Coluna deal_activities.actor ('human' | 'automation' | 'system') para distinguir
--      o toque HUMANO (liguei/visita/msg manual) do toque de AUTOMAÇÃO (email/WhatsApp
--      automático, IA, webhook) — o João quer ver ambos.
--   2. RPC deal_state_signals(p_org) que devolve, por negócio aberto, o estado real:
--      etapa + recência do último toque humano + actividades reais + tarefas em aberto.
--      Consumida pelo Inbox, follow-up, score (DASH-2) e Cérebro nas fatias seguintes.
--
-- Idempotente. Sem mudança de comportamento ainda (nenhum consumidor usa a RPC nesta fatia).

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Coluna `actor` em deal_activities
-- ───────────────────────────────────────────────────────────────────────────
alter table public.deal_activities
  add column if not exists actor text not null default 'human';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'deal_activities_actor_check'
  ) then
    alter table public.deal_activities
      add constraint deal_activities_actor_check
      check (actor in ('human', 'automation', 'system'));
  end if;
end $$;

-- Backfill: classifica as linhas existentes (o default 'human' cobre os logs manuais).
--  • tipos de bookkeeping (mudança de etapa, criação, sistema) = 'system' (não são toques);
--  • marcadores de automação/IA/webhook no metadata = 'automation';
--  • tudo o resto fica 'human' (CHQ manual, visita, chamada Notta, ditado por voz, Telegram).
update public.deal_activities
set actor = 'system'
where lower(type) in ('stage_moved', 'stage_change', 'created', 'system');

update public.deal_activities
set actor = 'automation'
where lower(coalesce(type, '')) not in ('stage_moved', 'stage_change', 'created', 'system')
  and (
       (metadata->>'auto_created') = 'true'
    or (metadata->>'created_via') = 'automation'
    or (metadata->>'via') ilike '%automation%'
    or (metadata->>'via') ilike '%webhook%'
    or (metadata->>'via') ilike '%agent%'
    or (metadata->>'source_execution_id') is not null
  );

create index if not exists idx_deal_activities_deal_actor_created
  on public.deal_activities (organization_id, deal_id, actor, created_at desc);

-- ───────────────────────────────────────────────────────────────────────────
-- 2. RPC `deal_state_signals` — a verdade única do estado, por negócio aberto.
-- ───────────────────────────────────────────────────────────────────────────
create or replace function public.deal_state_signals(p_org uuid)
returns table (
  deal_id uuid,
  board_id uuid,
  board_name text,
  stage_order integer,
  max_stage_order integer,
  is_holding boolean,
  last_human_touch timestamptz,
  last_automation_touch timestamptz,
  days_since_human_touch integer,
  days_idle integer,
  human_touches integer,
  automation_touches integer,
  visits integer,
  open_tasks integer,
  overdue_tasks integer,
  snoozed_until date,
  value numeric,
  status text
)
language sql
security definer
set search_path to 'public'
as $function$
  with d_today as (
    select (now() at time zone 'Europe/Lisbon')::date as today
  ),
  -- Toques reais (exclui bookkeeping), separados por actor humano vs automação.
  touch as (
    select
      da.deal_id,
      max(da.created_at) filter (where da.actor = 'human') as last_human_touch,
      max(da.created_at) filter (where da.actor = 'automation') as last_automation_touch,
      count(*) filter (where da.actor = 'human')::int as human_touches,
      count(*) filter (where da.actor = 'automation')::int as automation_touches,
      count(*) filter (
        where da.actor = 'human'
          and lower(da.type) in ('visit', 'visita', 'meeting', 'reuniao', 'reunião')
      )::int as visits
    from public.deal_activities da
    where da.organization_id = p_org
      and lower(da.type) not in ('stage_moved', 'stage_change', 'created', 'system')
    group by da.deal_id
  ),
  -- Tarefas reais em aberto (tabela activities), por negócio.
  tasks as (
    select
      a.deal_id,
      count(*)::int as open_tasks,
      count(*) filter (where a.date::date < (select today from d_today))::int as overdue_tasks
    from public.activities a
    where a.organization_id = p_org
      and not a.completed
      and a.deleted_at is null
      and a.deal_id is not null
    group by a.deal_id
  ),
  stage_span as (
    select board_id, max("order") as max_order
    from public.board_stages
    where organization_id = p_org
    group by board_id
  )
  select
    d.id as deal_id,
    d.board_id,
    b.name as board_name,
    coalesce(bs."order", 0) as stage_order,
    coalesce(ss.max_order, 0) as max_stage_order,
    coalesce(bs.excludes_followup, false) as is_holding,
    t.last_human_touch,
    t.last_automation_touch,
    case when t.last_human_touch is null then null
         else ((select today from d_today) - t.last_human_touch::date) end as days_since_human_touch,
    ((select today from d_today) - coalesce(t.last_human_touch, d.created_at)::date) as days_idle,
    coalesce(t.human_touches, 0) as human_touches,
    coalesce(t.automation_touches, 0) as automation_touches,
    coalesce(t.visits, 0) as visits,
    coalesce(tk.open_tasks, 0) as open_tasks,
    coalesce(tk.overdue_tasks, 0) as overdue_tasks,
    case when nullif(d.custom_fields->>'snoozedUntil', '') is null then null
         else (d.custom_fields->>'snoozedUntil')::date end as snoozed_until,
    d.value,
    case
      -- Adiado: pausa explícita (ressurge sozinho).
      when nullif(d.custom_fields->>'snoozedUntil', '') is not null
           and (d.custom_fields->>'snoozedUntil')::date >= (select today from d_today)
        then 'adiado'
      -- Por trabalhar: etapa de espera (Contactos) sem nenhum toque humano.
      when coalesce(bs.excludes_followup, false) and t.last_human_touch is null
        then 'por_trabalhar'
      -- Caso geral: recência do último toque humano (ou, se nunca houve, desde a entrada).
      when ((select today from d_today) - coalesce(t.last_human_touch, d.created_at)::date) <= 7
        then 'activo'
      when ((select today from d_today) - coalesce(t.last_human_touch, d.created_at)::date) <= 30
        then 'arrefecer'
      else 'parado'
    end as status
  from public.deals d
  join public.boards b on b.id = d.board_id
  left join touch t on t.deal_id = d.id
  left join tasks tk on tk.deal_id = d.id
  -- A etapa real está em d.stage_id (FK). d.status é o ciclo de vida em texto
  -- ('open'/'won'/'lost'), por isso NÃO serve para juntar à etapa.
  left join public.board_stages bs on bs.id = d.stage_id
  left join stage_span ss on ss.board_id = d.board_id
  where d.organization_id = p_org
    and not d.is_won
    and not d.is_lost;
$function$;

-- Wrapper para o cliente (resolve a org do utilizador autenticado), igual ao padrão do score.
create or replace function public.my_deal_state_signals()
returns table (
  deal_id uuid,
  board_id uuid,
  board_name text,
  stage_order integer,
  max_stage_order integer,
  is_holding boolean,
  last_human_touch timestamptz,
  last_automation_touch timestamptz,
  days_since_human_touch integer,
  days_idle integer,
  human_touches integer,
  automation_touches integer,
  visits integer,
  open_tasks integer,
  overdue_tasks integer,
  snoozed_until date,
  value numeric,
  status text
)
language sql
security definer
set search_path to 'public'
as $function$
  select * from public.deal_state_signals(get_user_org_id());
$function$;

revoke all on function public.deal_state_signals(uuid) from public, anon;
grant execute on function public.my_deal_state_signals() to authenticated;
