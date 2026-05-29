-- Meta Ads Fase B (b1) — tabela de métricas por anúncio (Marketing API Insights).
-- Ingerida pela edge `automation-meta-insights` (sync diário, visível em /automacoes).
-- Idempotente: upsert por (organization_id, integration_id, ad_id, date).

create table if not exists public.ad_insights (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  integration_id uuid not null references public.automation_integrations(id) on delete cascade,
  date date not null,
  level text not null default 'ad',
  ad_account_id text,
  campaign_id text,
  campaign_name text,
  adset_id text,
  adset_name text,
  ad_id text,
  ad_name text,
  spend numeric(14,2) not null default 0,
  impressions bigint not null default 0,
  clicks bigint not null default 0,
  leads integer not null default 0,
  reach bigint not null default 0,
  ctr numeric(12,6),
  cpc numeric(14,4),
  cpm numeric(14,4),
  currency text,
  raw jsonb,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Chave de upsert idempotente (nível anúncio; ad_id sempre presente).
create unique index if not exists ad_insights_unique_ad_day
  on public.ad_insights (organization_id, integration_id, ad_id, date);

create index if not exists ad_insights_org_date
  on public.ad_insights (organization_id, date desc);

create index if not exists ad_insights_org_campaign
  on public.ad_insights (organization_id, campaign_id);

alter table public.ad_insights enable row level security;

-- Leitura multi-tenant: só a própria org. Escrita é service-role (ignora RLS).
drop policy if exists "org read ad_insights" on public.ad_insights;
create policy "org read ad_insights" on public.ad_insights
  for select to authenticated
  using (organization_id = (select organization_id from public.profiles where id = auth.uid()));

comment on table public.ad_insights is 'Meta Ads Fase B: métricas diárias por anúncio (spend/impressions/clicks/leads). Sync pela edge automation-meta-insights, gerível em /automacoes.';
