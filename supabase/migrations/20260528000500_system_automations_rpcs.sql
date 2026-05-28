-- Sprint 27 c1: RPCs admin para gerir system_automations sem mexer em cron
-- directo. Validam admin via profiles.role. unschedule é idempotente
-- (apanha exception se job não existir).

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

  if p_cron_expression is null or length(trim(p_cron_expression)) = 0 then
    raise exception 'cron_expression required' using errcode = '22023';
  end if;
  if array_length(string_to_array(trim(p_cron_expression), ' '), 1) <> 5 then
    raise exception 'cron_expression deve ter 5 campos: min hora dia-mês mês dia-semana' using errcode = '22023';
  end if;

  select * into v_row from public.system_automations where key = p_key;
  if not found then raise exception 'automation not found: %', p_key using errcode = '42P01'; end if;

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

create or replace function public.update_system_automation_params(
  p_key text,
  p_params jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select role into v_role from profiles where id = v_user;
  if v_role <> 'admin' then raise exception 'admin only' using errcode = '42501'; end if;

  update public.system_automations set params = coalesce(p_params, '{}'::jsonb) where key = p_key;
  return jsonb_build_object('ok', true, 'key', p_key);
end;
$$;

create or replace function public.trigger_system_automation_now(
  p_key text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_role text;
  v_row public.system_automations%rowtype;
  v_req_id bigint;
begin
  if v_user is null then raise exception 'not authenticated' using errcode = '42501'; end if;
  select role into v_role from profiles where id = v_user;
  if v_role <> 'admin' then raise exception 'admin only' using errcode = '42501'; end if;

  select * into v_row from public.system_automations where key = p_key;
  if not found then raise exception 'automation not found: %', p_key using errcode = '42P01'; end if;

  select net.http_post(
    url := v_row.function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret' limit 1)
    ),
    body := jsonb_build_object('manual_trigger', true)
  ) into v_req_id;

  return jsonb_build_object('ok', true, 'key', p_key, 'request_id', v_req_id);
end;
$$;

revoke all on function public.toggle_system_automation(text, boolean) from public, authenticated;
revoke all on function public.update_system_automation_schedule(text, text) from public, authenticated;
revoke all on function public.update_system_automation_params(text, jsonb) from public, authenticated;
revoke all on function public.trigger_system_automation_now(text) from public, authenticated;

grant execute on function public.toggle_system_automation(text, boolean) to authenticated;
grant execute on function public.update_system_automation_schedule(text, text) to authenticated;
grant execute on function public.update_system_automation_params(text, jsonb) to authenticated;
grant execute on function public.trigger_system_automation_now(text) to authenticated;
