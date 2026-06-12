-- DASH-2 — Lead scoring: sinais por negocio aberto (o score calcula-se na app, lib pura testada).
--
-- Sem tabelas novas: tudo deriva do historico (deals + deal_activities + board_stages + contacts).
-- Espelha o padrao do CT-AUTO (deal_followups_due): SECURITY DEFINER + wrapper my_* authenticated.
-- Idempotente.

create or replace function public.deal_lead_score_signals(p_org uuid)
returns table (
  deal_id uuid,
  stage_order int,
  max_stage_order int,
  days_since_touch int,      -- null = nunca houve toque real
  touches int,               -- actividades reais (sem stage_moved/created/system)
  visits int,                -- visitas + reunioes
  value numeric,
  snoozed_until date,        -- adiado ate (null = nao adiado)
  email_opt_out boolean,
  source text
)
language sql
security definer
set search_path = public
as $$
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
      and lower(da.type) not in ('stage_moved', 'created', 'system')
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
  left join touch t on t.deal_id = d.id
  left join public.board_stages bs on bs.id::text = d.status
  left join stage_span ss on ss.board_id = d.board_id
  left join public.contacts c on c.id = d.contact_id
  where d.organization_id = p_org
    and not d.is_won
    and not d.is_lost;
$$;

create or replace function public.my_deal_lead_score_signals()
returns table (
  deal_id uuid,
  stage_order int,
  max_stage_order int,
  days_since_touch int,
  touches int,
  visits int,
  value numeric,
  snoozed_until date,
  email_opt_out boolean,
  source text
)
language sql
security definer
set search_path = public
as $$
  select * from public.deal_lead_score_signals(get_user_org_id());
$$;

revoke all on function public.deal_lead_score_signals(uuid) from public, anon;
grant execute on function public.deal_lead_score_signals(uuid) to service_role;
revoke all on function public.my_deal_lead_score_signals() from public, anon;
grant execute on function public.my_deal_lead_score_signals() to authenticated, service_role;
