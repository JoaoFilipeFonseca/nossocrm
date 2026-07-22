-- BRIEF 7 (movimento) — quem reage a um email de nurture sobe ao TOPO da Power List.
--
-- Recria power_list acrescentando o bucket 'reagiu_email' (prioridade 0, acima de
-- lead_nova). Um contacto que abriu/clicou/respondeu um email de nurture nas
-- últimas 48h entra no topo, com o motivo "Reagiu ao email X". Mantém intacta a
-- restante lógica e exclusões (opt-out, sem telefone, adiado, já tocado hoje).
-- A assinatura e as colunas devolvidas não mudam (my_power_list continua válido).

create or replace function public.power_list(p_org uuid, p_n integer default 15)
returns table(
  deal_id uuid,
  contact_id uuid,
  contact_name text,
  phone text,
  board_name text,
  stage_name text,
  source text,
  bucket text,
  priority integer,
  status text,
  last_human_touch timestamptz,
  last_automation_touch timestamptz,
  days_idle integer,
  value numeric,
  reason text
)
language sql
security definer
set search_path to 'public'
as $function$
  with d_today as (
    select (now() at time zone 'Europe/Lisbon')::date as today
  ),
  sig as (
    select * from public.deal_state_signals(p_org)
  ),
  touched_today as (
    select distinct da.deal_id
    from public.deal_activities da, d_today
    where da.organization_id = p_org
      and da.actor = 'human'
      and (da.created_at at time zone 'Europe/Lisbon')::date = (select today from d_today)
  ),
  reacted as (
    select
      ne.contact_id,
      max(greatest(
        coalesce(ne.opened_at, 'epoch'::timestamptz),
        coalesce(ne.clicked_at, 'epoch'::timestamptz),
        coalesce(ne.replied_at, 'epoch'::timestamptz)
      )) as reacted_at,
      (array_agg(ne.subject order by greatest(
        coalesce(ne.opened_at, 'epoch'::timestamptz),
        coalesce(ne.clicked_at, 'epoch'::timestamptz),
        coalesce(ne.replied_at, 'epoch'::timestamptz)
      ) desc))[1] as subject
    from public.nurture_emails ne
    where ne.organization_id = p_org
      and (ne.opened_at is not null or ne.clicked_at is not null or ne.replied_at is not null)
      and greatest(
        coalesce(ne.opened_at, 'epoch'::timestamptz),
        coalesce(ne.clicked_at, 'epoch'::timestamptz),
        coalesce(ne.replied_at, 'epoch'::timestamptz)
      ) >= now() - interval '48 hours'
    group by ne.contact_id
  ),
  enriched as (
    select
      s.deal_id, s.board_name, s.status, s.last_human_touch, s.last_automation_touch,
      s.days_idle, s.value, s.is_holding, s.overdue_tasks,
      d.contact_id, d.created_at, d.stage_id,
      c.name as contact_name, c.phone, c.source,
      coalesce(c.email_opt_out, false) as opted_out,
      bs.name as stage_name,
      r.reacted_at, r.subject as reacted_subject,
      (extract(epoch from ((now() at time zone 'Europe/Lisbon') - (d.created_at at time zone 'Europe/Lisbon'))) / 3600.0) as hours_since_created
    from sig s
    join public.deals d on d.id = s.deal_id
    left join public.contacts c on c.id = d.contact_id
    left join public.board_stages bs on bs.id = d.stage_id
    left join reacted r on r.contact_id = d.contact_id
  ),
  classified as (
    select e.*,
      case
        when e.reacted_at is not null then 'reagiu_email'
        when e.hours_since_created < 24 and e.last_human_touch is null then 'lead_nova'
        when e.overdue_tasks > 0 then 'followup'
        when e.last_human_touch is not null and e.status in ('arrefecer', 'parado') then 'followup'
        else 'reactivacao'
      end as bucket
    from enriched e
    where not e.opted_out
      and e.phone is not null
      and length(btrim(e.phone)) >= 6
      and e.status <> 'adiado'
      and e.deal_id not in (select deal_id from touched_today)
  )
  select
    c.deal_id,
    c.contact_id,
    c.contact_name,
    c.phone,
    c.board_name,
    c.stage_name,
    c.source,
    c.bucket,
    (case c.bucket when 'reagiu_email' then 0 when 'lead_nova' then 1 when 'followup' then 2 else 3 end) as priority,
    c.status,
    c.last_human_touch,
    c.last_automation_touch,
    c.days_idle,
    c.value,
    (case c.bucket
      when 'reagiu_email' then
        'Reagiu ao email "' || coalesce(c.reacted_subject, 'de nurture')
        || '". Abriu ou clicou nas últimas horas. Ligue enquanto está quente.'
      when 'lead_nova' then
        'Lead nova de ' || coalesce(nullif(c.source, ''), 'origem desconhecida')
        || ', ainda sem nenhum toque. É a primeira a ligar hoje.'
      when 'followup' then
        (case when c.overdue_tasks > 0 then 'Tem seguimento vencido. ' else '' end)
        || 'Já houve conversa; está ' || c.status
        || ' há ' || coalesce(c.days_idle::text, '?') || ' dias. Retome antes que esfrie.'
      else
        'Na base há ' || coalesce(c.days_idle::text, '?')
        || ' dias sem nenhum contacto (' || coalesce(nullif(c.source, ''), 'origem desconhecida')
        || '). Toque de reaproximação.'
    end) as reason
  from classified c
  order by
    (case c.bucket when 'reagiu_email' then 0 when 'lead_nova' then 1 when 'followup' then 2 else 3 end) asc,
    (case c.bucket
      when 'reagiu_email' then -extract(epoch from c.reacted_at)
      when 'lead_nova' then -extract(epoch from c.created_at)
      when 'followup' then -coalesce(c.days_idle, 0)::double precision
      else extract(epoch from c.created_at)
    end) asc,
    c.value desc nulls last,
    c.deal_id asc
  limit greatest(1, p_n);
$function$;
