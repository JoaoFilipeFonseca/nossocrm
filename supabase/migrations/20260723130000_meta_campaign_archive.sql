-- MA-ROUTING-UX — arquivar (não apagar) campanhas no painel de encaminhamento.
-- O flag de arquivo vive numa tabela dedicada (independente de meta_lead_routing,
-- que exige board_id NOT NULL e é apagada ao limpar destino). Uma campanha
-- arquivada reaparece sozinha se voltar a ficar activa ou receber lead nova
-- (a lógica de auto-reaparecimento é no GET /api/meta-ads/routing).
--
-- Idempotente. RLS de leitura por org (escrita só via service role no route admin).

create table if not exists public.meta_campaign_archive (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id text not null,
  campaign_name text,
  archived_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, campaign_id)
);

create index if not exists idx_meta_campaign_archive_org on public.meta_campaign_archive(organization_id);

alter table public.meta_campaign_archive enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policy join pg_class on pg_class.oid = polrelid
    where relname = 'meta_campaign_archive' and polname = 'org read meta_campaign_archive'
  ) then
    create policy "org read meta_campaign_archive" on public.meta_campaign_archive
      for select
      using (organization_id = (select profiles.organization_id from profiles where profiles.id = auth.uid()));
  end if;
end $$;
