-- Sprint 10 commit 1: metas de receita por organização (multi-tenant)
-- Cada organização configura a sua meta anual + quebra mensal (12 valores).
-- Usada em Métricas Honestas (subaba /dashboard).

create table if not exists public.org_revenue_goals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year smallint not null check (year between 2024 and 2100),
  annual_target_eur numeric(14,2) not null default 0 check (annual_target_eur >= 0),
  monthly_target_eur numeric(14,2)[] not null default array_fill(0::numeric(14,2), array[12])
    check (array_length(monthly_target_eur, 1) = 12),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, year)
);

create index if not exists idx_org_revenue_goals_org_year
  on public.org_revenue_goals (organization_id, year desc);

create or replace function public.org_revenue_goals_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_org_revenue_goals_updated_at on public.org_revenue_goals;
create trigger trg_org_revenue_goals_updated_at
  before update on public.org_revenue_goals
  for each row execute function public.org_revenue_goals_set_updated_at();

alter table public.org_revenue_goals enable row level security;

drop policy if exists "org members read revenue goals" on public.org_revenue_goals;
create policy "org members read revenue goals" on public.org_revenue_goals
  for select using (
    organization_id in (
      select profiles.organization_id from public.profiles
      where profiles.id = auth.uid()
    )
  );

drop policy if exists "org admins write revenue goals" on public.org_revenue_goals;
create policy "org admins write revenue goals" on public.org_revenue_goals
  for all using (
    organization_id in (
      select profiles.organization_id from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  ) with check (
    organization_id in (
      select profiles.organization_id from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'admin'
    )
  );

comment on table public.org_revenue_goals is 'Sprint 10: meta de receita anual + quebra mensal por organização. Usada em Métricas Honestas (Visão Geral).';
