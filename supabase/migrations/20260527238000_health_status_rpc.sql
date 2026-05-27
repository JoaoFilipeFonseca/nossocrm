-- Sprint 19 c1: compute_health_status RPC para admin ver estado operacional.
-- Devolve JSON com último backup, cron jobs activos, erros 24h, status AI keys.

create or replace function public.compute_health_status()
returns jsonb
language plpgsql
security definer
set search_path = public, storage, cron
as $$
declare
  v_user uuid := auth.uid();
  v_org uuid;
  v_role text;
  v_last_backup jsonb := 'null'::jsonb;
  v_cron_jobs jsonb := '[]'::jsonb;
  v_client_errors_24h int := 0;
  v_ai jsonb := 'null'::jsonb;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  select organization_id, role into v_org, v_role from profiles where id = v_user;
  if v_org is null or v_role <> 'admin' then
    raise exception 'admin only' using errcode = '42501';
  end if;

  select to_jsonb(b) into v_last_backup
  from (
    select name, created_at, (metadata->>'size')::bigint as size_bytes
    from storage.objects
    where bucket_id = 'backups'
      and name like v_org::text || '/%'
    order by created_at desc
    limit 1
  ) b;

  select jsonb_agg(
    jsonb_build_object(
      'jobid', jobid,
      'jobname', jobname,
      'schedule', schedule,
      'active', active
    )
    order by jobid
  ) into v_cron_jobs
  from cron.job
  where active = true;

  select count(*)::int into v_client_errors_24h
  from public.client_errors
  where organization_id = v_org
    and created_at >= now() - interval '24 hours';

  select jsonb_build_object(
    'gemini_configured', ai_google_key is not null and ai_google_key <> '',
    'anthropic_configured', ai_anthropic_key is not null and ai_anthropic_key <> '',
    'ai_enabled', coalesce(ai_enabled, false)
  ) into v_ai
  from organization_settings
  where organization_id = v_org;

  return jsonb_build_object(
    'generated_at', now(),
    'organization_id', v_org,
    'last_backup', coalesce(v_last_backup, 'null'::jsonb),
    'cron_jobs', coalesce(v_cron_jobs, '[]'::jsonb),
    'client_errors_24h', v_client_errors_24h,
    'ai', coalesce(v_ai, 'null'::jsonb)
  );
end;
$$;

revoke all on function public.compute_health_status() from public;
grant execute on function public.compute_health_status() to authenticated;
