-- CT-AUTO Fase 2a — Motor de follow-up "nunca perder uma lead" (centrado no negocio).
--
-- Config por org + RPC que devolve a "leva diaria" de negocios a retomar.
-- Modelo do Joao (08/06): leva rotativa por probabilidade (etapa + recencia) com
-- rede de seguranca (cooldown garante >=1 contacto por periodo) e "adiar em vez de perder".
-- Idempotente.

-- 1) Config na org (defaults).
alter table public.organization_settings
  add column if not exists followup_batch_size int not null default 10,
  add column if not exists followup_cooldown_days int not null default 30,
  add column if not exists followup_enabled boolean not null default true;

-- 2) RPC nuclear (service-role / edge): leva de negocios a retomar para uma org.
--    Elegiveis: abertos (nao won/lost) + nao adiados + fora do cooldown da leva +
--    sem engagement recente (>= cooldown dias). Ordena por etapa (desc) e recencia (desc).
--    "Engagement" = max(toque real, mudanca de etapa, criacao).
create or replace function public.deal_followups_due(
  p_org uuid,
  p_batch int default 10,
  p_cooldown int default 30
)
returns table (
  deal_id uuid,
  contact_id uuid,
  contact_name text,
  board_name text,
  stage_order int,
  last_engagement timestamptz,
  days_since int,
  value numeric
)
language sql
security definer
set search_path = public
as $$
  with d_today as (
    select (now() at time zone 'Europe/Lisbon')::date as today
  ),
  touch as (
    select da.deal_id, max(da.created_at) as last_touch
    from public.deal_activities da
    where da.organization_id = p_org
      and da.type not in ('stage_moved', 'created', 'system')
    group by da.deal_id
  ),
  default_stage as (
    select board_id, min("order") as def_order
    from public.board_stages
    where organization_id = p_org and is_default
    group by board_id
  )
  select
    d.id as deal_id,
    d.contact_id,
    c.name as contact_name,
    b.name as board_name,
    coalesce(bs."order", ds.def_order, 0) as stage_order,
    greatest(t.last_touch, d.last_stage_change_date, d.created_at) as last_engagement,
    ((select today from d_today) - greatest(t.last_touch, d.last_stage_change_date, d.created_at)::date) as days_since,
    d.value
  from public.deals d
  join public.boards b on b.id = d.board_id
  left join touch t on t.deal_id = d.id
  left join public.board_stages bs on bs.id::text = d.status
  left join default_stage ds on ds.board_id = d.board_id
  left join public.contacts c on c.id = d.contact_id
  where d.organization_id = p_org
    and not d.is_won
    and not d.is_lost
    -- nao adiado (adiar em vez de perder)
    and (
      (d.custom_fields->>'snoozedUntil') is null
      or (d.custom_fields->>'snoozedUntil') = ''
      or (d.custom_fields->>'snoozedUntil')::date < (select today from d_today)
    )
    -- fora do cooldown da leva (so volta passado o periodo => nunca perder)
    and (
      (d.custom_fields->>'followupQueuedOn') is null
      or (d.custom_fields->>'followupQueuedOn') = ''
      or (d.custom_fields->>'followupQueuedOn')::date <= (select today from d_today) - p_cooldown
    )
    -- sem engagement recente (parado ha >= cooldown dias)
    and greatest(t.last_touch, d.last_stage_change_date, d.created_at)::date
        <= (select today from d_today) - p_cooldown
  order by stage_order desc, last_engagement desc
  limit greatest(1, p_batch);
$$;

-- 3) Wrapper in-app (authenticated): usa a org do utilizador autenticado.
create or replace function public.my_deal_followups_due(
  p_batch int default 10,
  p_cooldown int default 30
)
returns table (
  deal_id uuid,
  contact_id uuid,
  contact_name text,
  board_name text,
  stage_order int,
  last_engagement timestamptz,
  days_since int,
  value numeric
)
language sql
security definer
set search_path = public
as $$
  select * from public.deal_followups_due(get_user_org_id(), p_batch, p_cooldown);
$$;

revoke all on function public.deal_followups_due(uuid, int, int) from public, anon;
grant execute on function public.deal_followups_due(uuid, int, int) to service_role;
revoke all on function public.my_deal_followups_due(int, int) from public, anon;
grant execute on function public.my_deal_followups_due(int, int) to authenticated, service_role;

-- 4) Indice para a varredura (negocios abertos por org).
create index if not exists idx_deals_org_open
  on public.deals (organization_id)
  where not is_won and not is_lost;
