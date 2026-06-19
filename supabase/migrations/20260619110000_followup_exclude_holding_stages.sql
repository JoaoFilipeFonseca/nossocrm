-- Modelo "contacto ≠ lead" (João, 19/06): etapas de espera (ex.: "Contactos") não entram no
-- motor de follow-up enquanto não houver um toque humano registado. Assim que se regista uma
-- chamada/email/mensagem (deal_activities, fora de stage_moved/created/system), o relógio conta
-- a partir dessa data (do zero). Etapas normais do funil mantêm o comportamento de "nunca perder
-- uma lead" (são acompanhadas mesmo sem toque).
--
-- A coluna excludes_followup marca essas etapas de espera (config por org; nas migrações de fresh
-- DB fica a false por omissão — quais etapas são "de espera" é dado operacional da org).

alter table public.board_stages
  add column if not exists excludes_followup boolean not null default false;

create or replace function public.deal_followups_due(p_org uuid, p_batch integer default 10, p_cooldown integer default 30)
 returns table(deal_id uuid, contact_id uuid, contact_name text, board_name text, stage_order integer, last_engagement timestamp with time zone, days_since integer, value numeric)
 language sql
 security definer
 set search_path to 'public'
as $function$
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
    -- Etapa de espera (Contactos) sem toque humano -> não conta para follow-up.
    and not (
      exists (select 1 from public.board_stages hs where hs.id = d.stage_id and hs.excludes_followup)
      and t.last_touch is null
    )
    and (
      (d.custom_fields->>'snoozedUntil') is null
      or (d.custom_fields->>'snoozedUntil') = ''
      or (d.custom_fields->>'snoozedUntil')::date < (select today from d_today)
    )
    and (
      (d.custom_fields->>'followupQueuedOn') is null
      or (d.custom_fields->>'followupQueuedOn') = ''
      or (d.custom_fields->>'followupQueuedOn')::date <= (select today from d_today) - p_cooldown
    )
    and greatest(t.last_touch, d.last_stage_change_date, d.created_at)::date
        <= (select today from d_today) - p_cooldown
  order by stage_order desc, last_engagement desc
  limit greatest(1, p_batch);
$function$;
