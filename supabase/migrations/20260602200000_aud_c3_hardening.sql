-- AUD-C3: hardening SQL (P3). Idempotente.
-- (1) Pinar search_path nas funções nossas sem ele (evita search_path mutável/hijack).
-- (2) Revogar EXECUTE de `anon` em 2 funções sensíveis (segredo do cron / token de API).
--     Grants explícitos (não via PUBLIC) → service_role/postgres/authenticated mantêm.

do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind = 'f'
      and p.oid not in (select objid from pg_depend where deptype = 'e')
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  loop
    execute format('alter function %s set search_path = public', r.sig::text);
  end loop;
end $$;

revoke execute on function public.get_backup_cron_secret() from anon;
revoke execute on function public._api_key_make_token() from anon;
