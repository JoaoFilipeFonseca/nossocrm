-- NS-1 Gestão Financeira — fundação.
-- 1) expenses: despesas operacionais do consultor (combustível, IA/software, fotografia,
--    material, formação, anúncios fora do Facebook, etc.), opcionalmente ligadas a um
--    negócio e/ou imóvel para calcular o ganho líquido real por angariação.
-- 2) Comissão por defeito da organização (% sobre a venda + parte do consultor),
--    com override possível por negócio em deals.custom_fields (commission_pct / consultant_share_pct).
-- CRUD feito pelo cliente autenticado (membros da org) → RLS org-scoped completa.

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  spent_on date not null default current_date,
  category text not null default 'outros',
  description text,
  amount_cents integer not null check (amount_cents >= 0),
  deal_id uuid references public.deals(id) on delete set null,
  imovel_id uuid references public.imoveis(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_expenses_org_date
  on public.expenses (organization_id, spent_on desc) where deleted_at is null;
create index if not exists idx_expenses_deal
  on public.expenses (deal_id) where deleted_at is null;

alter table public.expenses enable row level security;

-- Leitura/escrita org-scoped (mesmo padrão de resolução de org via profiles).
drop policy if exists "org read expenses" on public.expenses;
create policy "org read expenses" on public.expenses
  for select using (
    organization_id = (select profiles.organization_id from public.profiles where profiles.id = auth.uid())
  );

drop policy if exists "org insert expenses" on public.expenses;
create policy "org insert expenses" on public.expenses
  for insert with check (
    organization_id = (select profiles.organization_id from public.profiles where profiles.id = auth.uid())
  );

drop policy if exists "org update expenses" on public.expenses;
create policy "org update expenses" on public.expenses
  for update using (
    organization_id = (select profiles.organization_id from public.profiles where profiles.id = auth.uid())
  ) with check (
    organization_id = (select profiles.organization_id from public.profiles where profiles.id = auth.uid())
  );

drop policy if exists "org delete expenses" on public.expenses;
create policy "org delete expenses" on public.expenses
  for delete using (
    organization_id = (select profiles.organization_id from public.profiles where profiles.id = auth.uid())
  );

-- Comissão por defeito da organização (editável depois em Configurações).
alter table public.organization_settings
  add column if not exists default_commission_pct numeric(6,3) not null default 5,
  add column if not exists default_consultant_share_pct numeric(6,3) not null default 50;
