-- Sprint 15 c1: bucket privado backups + secret cron dedicado + helper RPC.

insert into storage.buckets (id, name, public)
values ('backups', 'backups', false)
on conflict (id) do nothing;

drop policy if exists "backups service role only read" on storage.objects;
drop policy if exists "backups service role only write" on storage.objects;

do $$
declare
  v_existing text;
begin
  select decrypted_secret into v_existing
  from vault.decrypted_secrets where name = 'backup_cron_secret' limit 1;
  if v_existing is null then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'backup_cron_secret',
      'Sprint 15: secret para o cron semanal de backup chamar a edge function backup-export.'
    );
  end if;
end $$;

create or replace function public.get_backup_cron_secret()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret' limit 1;
$$;

revoke all on function public.get_backup_cron_secret() from public, authenticated;

comment on function public.get_backup_cron_secret() is
'Sprint 15 c1: usado apenas pelo pg_cron job backup-weekly para autenticar a chamada à edge function backup-export.';
