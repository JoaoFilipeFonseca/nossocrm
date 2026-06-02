-- AUD-C1: fechar políticas RLS using(true) que abriam escrita a public/cross-tenant.
-- AUD-C2: tornar privados os 3 buckets públicos e remover listagem ampla.
-- Idempotente. Escritores de automation_* usam service_role (ignora RLS) → drops seguros.

-- ── AUD-C1 Grupo A: 9 políticas de escrita automation_* com role `public` + using/with_check(true).
drop policy if exists "automation_credentials_insert_service"       on public.automation_credentials;
drop policy if exists "automation_events_insert_service"            on public.automation_events;
drop policy if exists "automation_executions_insert_service"        on public.automation_executions;
drop policy if exists "automation_executions_update_service"        on public.automation_executions;
drop policy if exists "automation_node_executions_insert_service"   on public.automation_node_executions;
drop policy if exists "automation_node_executions_update_service"   on public.automation_node_executions;
drop policy if exists "automation_schedules_insert_service"         on public.automation_schedules;
drop policy if exists "automation_schedules_update_service"         on public.automation_schedules;
drop policy if exists "automation_schedules_delete_service"         on public.automation_schedules;

-- ── AUD-C1 Grupo B: organizations FOR ALL a authenticated lia/alterava TODAS as orgs.
drop policy if exists "authenticated_access" on public.organizations;
create policy "authenticated_access" on public.organizations
  for all to authenticated
  using (deleted_at is null and id = public.get_user_org_id())
  with check (id = public.get_user_org_id());

-- ── AUD-C1: client_errors INSERT scoped à própria org (o reporter já grava organization_id do perfil).
drop policy if exists "any authenticated can insert client error" on public.client_errors;
create policy "any authenticated can insert client error" on public.client_errors
  for insert to authenticated
  with check (organization_id = public.get_user_org_id());

-- ── AUD-C2: buckets privados (servimos por URL assinado no código).
update storage.buckets set public = false where id in ('avatars','imovel-fotos','messaging-media');

drop policy if exists "avatar_select" on storage.objects;
drop policy if exists "avatars read authenticated" on storage.objects;
create policy "avatars read authenticated" on storage.objects
  for select to authenticated using (bucket_id = 'avatars');

drop policy if exists "imovel-fotos read" on storage.objects;
drop policy if exists "imovel-fotos read own org" on storage.objects;
create policy "imovel-fotos read own org" on storage.objects
  for select to authenticated
  using (bucket_id = 'imovel-fotos' and (storage.foldername(name))[1] = public.get_user_org_id()::text);

drop policy if exists "Public read messaging media" on storage.objects;
drop policy if exists "messaging-media read own org" on storage.objects;
create policy "messaging-media read own org" on storage.objects
  for select to authenticated
  using (bucket_id = 'messaging-media' and (storage.foldername(name))[1] = public.get_user_org_id()::text);
