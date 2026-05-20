-- =====================================================
-- Imóveis v2 — Schema completo nível portal sério
-- (Imovirtual / Idealista / KW / RE/MAX / Century 21)
-- Aplicado: 20 Mai 2026
-- =====================================================

alter table public.imoveis
  add column if not exists tipo text default 'apartamento',
  add column if not exists subtipo text,
  add column if not exists estado_conservacao text,
  add column if not exists codigo_postal text,
  add column if not exists numero_policia text,
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists ocultar_morada boolean default false,
  add column if not exists area_terreno numeric,
  add column if not exists area_dependente numeric,
  add column if not exists quartos integer,
  add column if not exists quartos_suite integer,
  add column if not exists wcs integer,
  add column if not exists piso integer,
  add column if not exists pisos_imovel integer,
  add column if not exists cozinha_tipo text,
  add column if not exists sala_m2 numeric,
  add column if not exists ano_remodelacao integer,
  add column if not exists ce_numero text,
  add column if not exists ce_validade date,
  add column if not exists aquecimento text,
  add column if not exists tem_ac boolean default false,
  add column if not exists agua text,
  add column if not exists paineis_solares text,
  add column if not exists caixilharia text,
  add column if not exists vidros_duplos boolean default false,
  add column if not exists orientacao text,
  add column if not exists vista text,
  add column if not exists tem_condominio boolean default false,
  add column if not exists condominio_mensal numeric,
  add column if not exists condominio_inclui text,
  add column if not exists imi_anual numeric,
  add column if not exists renda_mensal numeric,
  add column if not exists titulo_anuncio text,
  add column if not exists descricao_longa text,
  add column if not exists destaques text[],
  add column if not exists publico_alvo text[],
  add column if not exists publicado_em text[],
  add column if not exists ref_idealista text,
  add column if not exists ref_imovirtual text,
  add column if not exists ref_casasapo text,
  add column if not exists ref_kw text,
  add column if not exists caracteristicas jsonb default '{}'::jsonb;

create index if not exists idx_imoveis_tipo on public.imoveis(organization_id, tipo);
create index if not exists idx_imoveis_codigo_postal on public.imoveis(codigo_postal) where codigo_postal is not null;
create index if not exists idx_imoveis_caracteristicas_gin on public.imoveis using gin (caracteristicas);

create table if not exists public.imovel_fotos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  imovel_id uuid references public.imoveis(id) on delete cascade not null,
  storage_path text not null,
  url_publica text,
  ordem integer default 0,
  caption text,
  is_principal boolean default false,
  width integer,
  height integer,
  bytes integer,
  origem text default 'upload',
  uploaded_at timestamptz default now()
);

create index if not exists idx_imovel_fotos_imovel on public.imovel_fotos(imovel_id, ordem);
create unique index if not exists uniq_imovel_principal
  on public.imovel_fotos(imovel_id) where is_principal = true;

alter table public.imovel_fotos enable row level security;
create policy "imovel_fotos: org read" on public.imovel_fotos
  for select using (organization_id = get_user_org_id());
create policy "imovel_fotos: org write" on public.imovel_fotos
  for all using (organization_id = get_user_org_id())
  with check (organization_id = get_user_org_id());

create table if not exists public.imovel_documentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  imovel_id uuid references public.imoveis(id) on delete cascade not null,
  kind text not null,
  filename text not null,
  storage_path text not null,
  bytes integer,
  mime_type text,
  metadata jsonb default '{}'::jsonb,
  uploaded_at timestamptz default now()
);

create index if not exists idx_imovel_documentos_imovel on public.imovel_documentos(imovel_id, uploaded_at desc);
create index if not exists idx_imovel_documentos_kind on public.imovel_documentos(organization_id, kind);

alter table public.imovel_documentos enable row level security;
create policy "imovel_documentos: org read" on public.imovel_documentos
  for select using (organization_id = get_user_org_id());
create policy "imovel_documentos: org write" on public.imovel_documentos
  for all using (organization_id = get_user_org_id())
  with check (organization_id = get_user_org_id());

create table if not exists public.imovel_mandatos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  imovel_id uuid references public.imoveis(id) on delete cascade not null,
  tipo text not null,
  data_inicio date not null,
  data_fim date,
  comissao_pct numeric,
  comissao_paga_por text,
  documento_id uuid references public.imovel_documentos(id) on delete set null,
  notas text,
  activo boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_imovel_mandatos_imovel on public.imovel_mandatos(imovel_id, activo);

alter table public.imovel_mandatos enable row level security;
create policy "imovel_mandatos: org read" on public.imovel_mandatos
  for select using (organization_id = get_user_org_id());
create policy "imovel_mandatos: org write" on public.imovel_mandatos
  for all using (organization_id = get_user_org_id())
  with check (organization_id = get_user_org_id());

create table if not exists public.imovel_proprietarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  imovel_id uuid references public.imoveis(id) on delete cascade not null,
  contact_id uuid references public.contacts(id) on delete set null,
  nome text,
  percentagem numeric,
  regime_bens text,
  e_residente boolean default true,
  notas text,
  created_at timestamptz default now()
);

create index if not exists idx_imovel_proprietarios_imovel on public.imovel_proprietarios(imovel_id);

alter table public.imovel_proprietarios enable row level security;
create policy "imovel_proprietarios: org read" on public.imovel_proprietarios
  for select using (organization_id = get_user_org_id());
create policy "imovel_proprietarios: org write" on public.imovel_proprietarios
  for all using (organization_id = get_user_org_id())
  with check (organization_id = get_user_org_id());

create table if not exists public.proprietario_documentos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  proprietario_id uuid references public.imovel_proprietarios(id) on delete cascade not null,
  kind text not null,
  filename text not null,
  storage_path text not null,
  bytes integer,
  validade date,
  metadata jsonb default '{}'::jsonb,
  uploaded_at timestamptz default now()
);

create index if not exists idx_proprietario_documentos_prop on public.proprietario_documentos(proprietario_id);

alter table public.proprietario_documentos enable row level security;
create policy "proprietario_documentos: org read" on public.proprietario_documentos
  for select using (organization_id = get_user_org_id());
create policy "proprietario_documentos: org write" on public.proprietario_documentos
  for all using (organization_id = get_user_org_id())
  with check (organization_id = get_user_org_id());

insert into storage.buckets (id, name, public)
values
  ('imovel-fotos', 'imovel-fotos', true),
  ('imovel-documentos', 'imovel-documentos', false),
  ('proprietario-documentos', 'proprietario-documentos', false)
on conflict (id) do nothing;

drop policy if exists "imovel-fotos read" on storage.objects;
create policy "imovel-fotos read" on storage.objects
  for select using (bucket_id = 'imovel-fotos');

drop policy if exists "imovel-fotos write" on storage.objects;
create policy "imovel-fotos write" on storage.objects
  for insert with check (bucket_id = 'imovel-fotos' and auth.uid() is not null);

drop policy if exists "imovel-fotos delete" on storage.objects;
create policy "imovel-fotos delete" on storage.objects
  for delete using (bucket_id = 'imovel-fotos' and auth.uid() is not null);

drop policy if exists "imovel-documentos all" on storage.objects;
create policy "imovel-documentos all" on storage.objects
  for all using (bucket_id = 'imovel-documentos' and auth.uid() is not null)
  with check (bucket_id = 'imovel-documentos' and auth.uid() is not null);

drop policy if exists "proprietario-documentos all" on storage.objects;
create policy "proprietario-documentos all" on storage.objects
  for all using (bucket_id = 'proprietario-documentos' and auth.uid() is not null)
  with check (bucket_id = 'proprietario-documentos' and auth.uid() is not null);
