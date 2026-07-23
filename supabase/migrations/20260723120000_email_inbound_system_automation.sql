-- MSG-3 / task_3ebe04f0 — Email inbound (respostas dos leads entram no CRM).
-- Regista a automação 'email-inbound' em /automacoes como um WEBHOOK (event-driven),
-- não um cron. Para isso:
--   1. system_automations ganha coluna `kind` ('cron' | 'webhook').
--   2. As RPCs de gestão saltam o agendamento pg_cron quando kind='webhook'
--      (um webhook dispara-se com cada email recebido, não por horário).
--   3. Insere a linha 'email-inbound' (kind='webhook'), ON/OFF respeitado pela
--      edge messaging-webhook-resend.
--
-- Idempotente. Não mexe nas automações de cron existentes.

-- 1) Coluna kind ------------------------------------------------------------
alter table public.system_automations
  add column if not exists kind text not null default 'cron';

-- 2) RPCs: saltar cron quando kind='webhook' -------------------------------
create or replace function public.toggle_system_automation(
  p_key text,
  p_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = public, cron
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_row public.system_automations%rowtype;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select role into v_role from profiles where id = v_user;
  if v_role <> 'admin' then raise exception 'admin only' using errcode = '42501'; end if;

  select * into v_row from public.system_automations where key = p_key;
  if not found then raise exception 'automation not found: %', p_key using errcode = '42P01'; end if;

  -- Webhooks (event-driven) não têm job pg_cron: o ON/OFF é só a flag `enabled`,
  -- que a edge respeita. Só as automações de cron mexem no agendador.
  if v_row.kind = 'cron' then
    begin perform cron.unschedule(v_row.cron_job_name); exception when others then null; end;

    if p_enabled then
      perform cron.schedule(
        v_row.cron_job_name,
        v_row.cron_expression,
        format($cmd$
          select net.http_post(
            url := %L,
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret' limit 1)
            ),
            body := '{}'::jsonb
          );
        $cmd$, v_row.function_url)
      );
    end if;
  end if;

  update public.system_automations set enabled = p_enabled where key = p_key;
  return jsonb_build_object('ok', true, 'key', p_key, 'enabled', p_enabled);
end;
$$;

create or replace function public.update_system_automation_schedule(
  p_key text,
  p_cron_expression text
)
returns jsonb
language plpgsql
security definer
set search_path = public, cron
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_row public.system_automations%rowtype;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select role into v_role from profiles where id = v_user;
  if v_role <> 'admin' then raise exception 'admin only' using errcode = '42501'; end if;

  select * into v_row from public.system_automations where key = p_key;
  if not found then raise exception 'automation not found: %', p_key using errcode = '42P01'; end if;

  -- Webhooks não têm horário editável.
  if v_row.kind <> 'cron' then
    raise exception 'automação % é event-driven (webhook): não tem horário', p_key using errcode = '22023';
  end if;

  if p_cron_expression is null or length(trim(p_cron_expression)) = 0 then
    raise exception 'cron_expression required' using errcode = '22023';
  end if;
  if array_length(string_to_array(trim(p_cron_expression), ' '), 1) <> 5 then
    raise exception 'cron_expression deve ter 5 campos: min hora dia-mês mês dia-semana' using errcode = '22023';
  end if;

  update public.system_automations set cron_expression = p_cron_expression where key = p_key;

  if v_row.enabled then
    begin perform cron.unschedule(v_row.cron_job_name); exception when others then null; end;
    perform cron.schedule(
      v_row.cron_job_name,
      p_cron_expression,
      format($cmd$
        select net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret' limit 1)
          ),
          body := '{}'::jsonb
        );
      $cmd$, v_row.function_url)
    );
  end if;

  return jsonb_build_object('ok', true, 'key', p_key, 'cron_expression', p_cron_expression);
end;
$$;

-- 3) Linha da automação -----------------------------------------------------
-- cron_job_name/cron_expression são NOT NULL no schema; para um webhook são só
-- rótulos (kind='webhook' impede qualquer agendamento). function_url aponta para
-- a edge (referência; o disparo é sempre o Resend/Worker a POSTar um email).
insert into public.system_automations
  (key, name, description, icon, kind, cron_job_name, cron_expression, function_url, enabled, params)
values (
  'email-inbound',
  'Email inbound (respostas dos leads)',
  'Quando um lead responde a um email do João, a resposta entra no CRM (mensagem + timeline do negócio) para a IA ter a conversa dos dois lados. Nunca cria lead: só associa a contactos/negócios existentes.',
  '📥',
  'webhook',
  'email-inbound',
  '@webhook',
  'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/messaging-webhook-resend',
  true,
  '{}'::jsonb
)
on conflict (key) do update
  set kind = excluded.kind,
      name = excluded.name,
      description = excluded.description,
      icon = excluded.icon,
      cron_expression = excluded.cron_expression,
      function_url = excluded.function_url;
