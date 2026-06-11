-- MKT-BIBLIOTECA Fatia 1 — o creative_archive passa a repositório de TODOS os activos digitais.
-- Novas dimensões: origem (criado/importado/referência), ficheiro no bucket privado,
-- registo de utilizações ("usei em X a Y"), ligação pai/filho (duplicados/versões)
-- e render_spec (parâmetros dos templates da marca, usados na Fatia 2).

alter table public.creative_archive
  add column if not exists origin text not null default 'created',
  add column if not exists file_path text,
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists mime_type text,
  add column if not exists usages jsonb not null default '[]'::jsonb,
  add column if not exists render_spec jsonb,
  add column if not exists parent_id uuid references public.creative_archive(id) on delete set null;

-- A origem dos registos existentes deriva do source que já existia.
update public.creative_archive set origin = 'imported' where source = 'imported' and origin <> 'imported';

do $$ begin
  alter table public.creative_archive
    add constraint creative_archive_origin_check check (origin in ('created','imported','reference'));
exception when duplicate_object then null; end $$;

create index if not exists creative_archive_org_origin_idx
  on public.creative_archive (organization_id, origin);
create index if not exists creative_archive_parent_idx
  on public.creative_archive (parent_id) where parent_id is not null;
create index if not exists creative_archive_imovel_idx
  on public.creative_archive (imovel_id) where imovel_id is not null;

-- Storage: o bucket creative-archive é privado e não tinha políticas (só o service role chegava lá).
-- Membros da org passam a ler/escrever no prefixo da própria org (1.º segmento do path = org id),
-- como o imovel-fotos. Servimos sempre por URL assinado no código.
drop policy if exists "creative-archive read own org" on storage.objects;
create policy "creative-archive read own org" on storage.objects
  for select to authenticated
  using (bucket_id = 'creative-archive' and (storage.foldername(name))[1] = public.get_user_org_id()::text);

drop policy if exists "creative-archive write own org" on storage.objects;
create policy "creative-archive write own org" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'creative-archive' and (storage.foldername(name))[1] = public.get_user_org_id()::text);

drop policy if exists "creative-archive delete own org" on storage.objects;
create policy "creative-archive delete own org" on storage.objects
  for delete to authenticated
  using (bucket_id = 'creative-archive' and (storage.foldername(name))[1] = public.get_user_org_id()::text);
