-- BRIEF 2 — Power List automática (08:45, 2ª a 6ª).
--
-- RPC `power_list(org, n)` devolve os N contactos a ligar HOJE, ordenados por
-- prioridade real, com contexto e motivo. Assenta na verdade única
-- `deal_state_signals` (toque humano vs automação) e respeita as exclusões RGPD.
--
-- Prioridade:
--   1 lead_nova     — negócio criado < 24h e ainda sem toque humano (liga primeiro).
--   2 followup      — tarefa de seguimento vencida, OU já houve conversa e está
--                     'arrefecer'/'parado' (relação a retomar antes de esfriar).
--   3 reactivacao   — a base fria: sem toque humano, do mais antigo para o mais
--                     recente (limpar o gargalo dos contactos por trabalhar).
--
-- Exclui: opt-out (email_opt_out), adiados ('adiado'), sem telefone válido,
-- e negócios já com um toque humano HOJE (assim o "liguei" tira-os da lista).
-- (Domingos e Sábados: tratados pelo cron — 2ª a 6ª.)

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
  enriched as (
    select
      s.deal_id, s.board_name, s.status, s.last_human_touch, s.last_automation_touch,
      s.days_idle, s.value, s.is_holding, s.overdue_tasks,
      d.contact_id, d.created_at, d.stage_id,
      c.name as contact_name, c.phone, c.source,
      coalesce(c.email_opt_out, false) as opted_out,
      bs.name as stage_name,
      (extract(epoch from ((now() at time zone 'Europe/Lisbon') - (d.created_at at time zone 'Europe/Lisbon'))) / 3600.0) as hours_since_created
    from sig s
    join public.deals d on d.id = s.deal_id
    left join public.contacts c on c.id = d.contact_id
    left join public.board_stages bs on bs.id = d.stage_id
  ),
  classified as (
    select e.*,
      case
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
    (case c.bucket when 'lead_nova' then 1 when 'followup' then 2 else 3 end) as priority,
    c.status,
    c.last_human_touch,
    c.last_automation_touch,
    c.days_idle,
    c.value,
    (case c.bucket
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
    (case c.bucket when 'lead_nova' then 1 when 'followup' then 2 else 3 end) asc,
    (case c.bucket
      when 'lead_nova' then -extract(epoch from c.created_at)
      when 'followup' then -coalesce(c.days_idle, 0)::double precision
      else extract(epoch from c.created_at)
    end) asc,
    c.value desc nulls last,
    c.deal_id asc
  limit greatest(1, p_n);
$function$;

-- Wrapper para a UI autenticada (/hoje) — usa a org do utilizador.
create or replace function public.my_power_list(p_n integer default 15)
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
  select * from public.power_list(public.get_user_org_id(), p_n);
$function$;

revoke all on function public.power_list(uuid, integer) from public;
grant execute on function public.power_list(uuid, integer) to service_role;
grant execute on function public.my_power_list(integer) to authenticated;

-- Registo em /automacoes + pg_cron 07:45 UTC (= 08:45 Europe/Lisbon no horário de
-- verão) de 2ª a 6ª. Chama a rota Next /api/power-list/run. Idempotente.
insert into public.system_automations
  (key, name, description, icon, cron_job_name, cron_expression, function_url, enabled, params)
values
  ('power-list',
   'Power List do dia (08:45)',
   'De 2ª a 6ª às 08:45: monta a lista dos contactos a ligar hoje (leads novas, seguimentos vencidos e reactivação da base do mais antigo), com o motivo e uma primeira frase sugerida pela IA. Envia por email (marca do João) e um resumo no Telegram, e alimenta a página /hoje. Inclui o número do dia: conversas da semana vs meta.',
   '📞',
   'power-list',
   '45 7 * * 1-5',
   'https://crm.joaofilipefonseca.pt/api/power-list/run',
   true,
   '{"list_size": 15, "weekly_goal": 25}'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  cron_expression = excluded.cron_expression,
  function_url = excluded.function_url,
  params = excluded.params;

do $$
begin
  perform cron.unschedule('power-list');
exception when others then null;
end $$;

select cron.schedule(
  'power-list',
  '45 7 * * 1-5',
  $cmd$
    select net.http_post(
      url := 'https://crm.joaofilipefonseca.pt/api/power-list/run',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret' limit 1)
      ),
      body := '{}'::jsonb
    );
  $cmd$
);
