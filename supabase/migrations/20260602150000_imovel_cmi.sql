-- IMO-6 Fase 1 — CMI (Contrato de Mediação Imobiliária), separado do "mandato".
-- Contrato do lado do vendedor/angariação, ligado ao imóvel. Org-scoped + RLS.

create table if not exists public.imovel_cmi (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  imovel_id uuid not null references public.imoveis(id) on delete cascade,
  tipo text not null default 'exclusivo' check (tipo in ('simples', 'exclusivo')),
  data_cmi date not null,
  data_fim date,
  comissao_pct numeric,
  notas text,
  activo boolean not null default true,
  created_at timestamptz default now()
);

create index if not exists idx_imovel_cmi_imovel on public.imovel_cmi(imovel_id);
create index if not exists idx_imovel_cmi_org on public.imovel_cmi(organization_id);

alter table public.imovel_cmi enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'imovel_cmi' and policyname = 'imovel_cmi: org read'
  ) then
    create policy "imovel_cmi: org read" on public.imovel_cmi
      for select using (organization_id = get_user_org_id());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'imovel_cmi' and policyname = 'imovel_cmi: org write'
  ) then
    create policy "imovel_cmi: org write" on public.imovel_cmi
      for all using (organization_id = get_user_org_id())
      with check (organization_id = get_user_org_id());
  end if;
end $$;
