-- Sprint 18 c1: captura erros front-end em produção sem dependência externa.
-- Tabela minimal + RLS insert-only para authenticated.

create table if not exists public.client_errors (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  source text not null check (source in ('window.onerror','unhandledrejection','manual','react-boundary')),
  message text not null,
  stack text,
  url text,
  user_agent text,
  metadata jsonb default '{}'::jsonb,
  resolved boolean default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_client_errors_org_created on public.client_errors (organization_id, created_at desc);
create index if not exists idx_client_errors_unresolved on public.client_errors (created_at desc) where resolved = false;

alter table public.client_errors enable row level security;

drop policy if exists "any authenticated can insert client error" on public.client_errors;
create policy "any authenticated can insert client error" on public.client_errors
  for insert to authenticated
  with check (true);

drop policy if exists "org admins read client errors" on public.client_errors;
create policy "org admins read client errors" on public.client_errors
  for select to authenticated
  using (
    organization_id is null
    or organization_id in (
      select profiles.organization_id from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

drop policy if exists "org admins update client errors" on public.client_errors;
create policy "org admins update client errors" on public.client_errors
  for update to authenticated
  using (
    organization_id in (
      select profiles.organization_id from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

comment on table public.client_errors is 'Sprint 18 c1: erros front-end capturados via window.onerror, unhandledrejection ou manualmente. Admin lê para diagnosticar bugs em prod.';
