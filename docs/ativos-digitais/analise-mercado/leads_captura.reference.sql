-- ============================================================================
-- ⚠️ FICHEIRO DE REFERÊNCIA — provavelmente NÃO usado tal como está ⚠️
-- Versão original criada pelo João (chat de IA). Cria uma tabela ISOLADA
-- `leads_captura` que NÃO faz parte do funil do CRM. Ver PREP.md: a decisão
-- (22/06, João = opção A) é a landing alimentar o funil REAL (contacts + deals
-- com proveniência), como as leads do Meta Ads — e não esta tabela à parte.
-- Mantido aqui só como referência dos CAMPOS que a landing recolhe.
-- ============================================================================

create table if not exists public.leads_captura (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),

  -- contacto
  nome              text not null,
  telefone          text not null,
  email             text not null,
  horario_contacto  text,

  -- imóvel
  localizacao   text,
  tipo_imovel   text,
  tipologia     text,
  estado        text,
  area          text,
  extras        text[] default '{}',

  -- intenção
  prazo_venda   text,
  motivo        text,

  -- tracking / atribuição
  origem        text default 'landing-analise-mercado',
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_content   text,
  utm_term      text,
  referrer      text,
  landing_url   text,

  -- pipeline
  estado_lead   text not null default 'novo',  -- novo | contactado | visita_marcada | angariado | perdido
  consentimento boolean not null default false
);

create index if not exists idx_leads_captura_created_at on public.leads_captura (created_at desc);
create index if not exists idx_leads_captura_estado     on public.leads_captura (estado_lead);
create index if not exists idx_leads_captura_campaign    on public.leads_captura (utm_campaign);

alter table public.leads_captura enable row level security;

drop policy if exists "leitura_autenticados" on public.leads_captura;
create policy "leitura_autenticados"
  on public.leads_captura
  for select
  to authenticated
  using (true);

drop policy if exists "update_autenticados" on public.leads_captura;
create policy "update_autenticados"
  on public.leads_captura
  for update
  to authenticated
  using (true)
  with check (true);
