-- =====================================================
-- #120 Modelo grafo Imóvel + Histórico — Bloco 1 Sub-task 5
-- Tabelas autónomas do imóvel + histórico cronológico
-- + FK opcional em deals. ADDITIVE.
-- Aplicado: 21 Mai 2026
-- =====================================================

create table if not exists public.imoveis (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  referencia text,
  morada text,
  freguesia text,
  concelho text,
  distrito text default 'Porto',
  tipologia text,
  area_util numeric,
  area_bruta numeric,
  ano_construcao integer,
  certificado_energetico text,
  preco_actual numeric,
  preco_inicial numeric,
  preco_minimo_aceitavel numeric,
  estado text default 'disponivel',
  tipo_negocio text default 'venda',
  caderneta_pdf_url text,
  fotos_urls text[] default array[]::text[],
  link_externo text,
  notas_privadas text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_imoveis_organization on public.imoveis(organization_id);
create index if not exists idx_imoveis_referencia
  on public.imoveis(organization_id, referencia) where referencia is not null;
create index if not exists idx_imoveis_estado on public.imoveis(organization_id, estado);
create index if not exists idx_imoveis_tipologia on public.imoveis(organization_id, tipologia);
create index if not exists idx_imoveis_concelho on public.imoveis(organization_id, concelho);

create or replace function public.update_imoveis_updated_at()
returns trigger language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists imoveis_updated_at_trigger on public.imoveis;
create trigger imoveis_updated_at_trigger
before update on public.imoveis
for each row execute function public.update_imoveis_updated_at();

create table if not exists public.imovel_eventos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  imovel_id uuid references public.imoveis(id) on delete cascade not null,
  kind text not null,
  contact_id uuid references public.contacts(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  valor numeric,
  descricao text,
  metadata jsonb default '{}'::jsonb,
  occurred_at timestamptz default now(),
  created_at timestamptz default now()
);

create index if not exists idx_imovel_eventos_imovel
  on public.imovel_eventos(imovel_id, occurred_at desc);
create index if not exists idx_imovel_eventos_kind
  on public.imovel_eventos(organization_id, kind);
create index if not exists idx_imovel_eventos_deal
  on public.imovel_eventos(deal_id) where deal_id is not null;
create index if not exists idx_imovel_eventos_contact
  on public.imovel_eventos(contact_id) where contact_id is not null;

alter table public.deals
  add column if not exists imovel_id uuid references public.imoveis(id) on delete set null;

create index if not exists idx_deals_imovel
  on public.deals(imovel_id) where imovel_id is not null;

alter table public.imoveis enable row level security;
alter table public.imovel_eventos enable row level security;

create policy "imoveis: org read"
  on public.imoveis for select using (organization_id = get_user_org_id());
create policy "imoveis: org write"
  on public.imoveis for all
  using (organization_id = get_user_org_id())
  with check (organization_id = get_user_org_id());

create policy "imovel_eventos: org read"
  on public.imovel_eventos for select using (organization_id = get_user_org_id());
create policy "imovel_eventos: org write"
  on public.imovel_eventos for all
  using (organization_id = get_user_org_id())
  with check (organization_id = get_user_org_id());

comment on table public.imoveis is
  'Imóvel autónomo independente de comprador/vendedor. Liga-se a deals via imovel_id e a contacts via imovel_eventos.';
comment on table public.imovel_eventos is
  'Histórico cronológico do imóvel: visitas, ofertas, mudanças de preço, CPCV, escritura, etc.';
comment on column public.imoveis.preco_minimo_aceitavel is
  'Mínimo que o vendedor aceita. Só visível ao João — UI deve esconder de outros papéis (regra a aplicar quando UI existir).';
