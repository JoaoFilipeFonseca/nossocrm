-- Meta Ads — encaminhamento de leads por campanha (R2 da recepção de leads).
-- Cada campanha (comprador/vendedor/arrendamento) aponta para um board+etapa.
-- Quando entra uma lead, o webhook resolve o destino pela campanha do anúncio.
-- Escritas feitas por service_role (API valida admin+org); leitura org-scoped.

create table if not exists public.meta_lead_routing (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id text not null,
  campaign_name text,
  board_id uuid not null references public.boards(id) on delete cascade,
  stage_id uuid references public.board_stages(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, campaign_id)
);

create index if not exists idx_meta_lead_routing_org on public.meta_lead_routing (organization_id);

alter table public.meta_lead_routing enable row level security;

-- Leitura org-scoped (mesmo padrão de ad_insights). Escritas via service_role.
drop policy if exists "org read meta_lead_routing" on public.meta_lead_routing;
create policy "org read meta_lead_routing" on public.meta_lead_routing
  for select
  using (
    organization_id = (select profiles.organization_id from public.profiles where profiles.id = auth.uid())
  );
