-- Brief 6 — Radar Maia
-- Recolha diária de novas casas no mercado da Maia (Idealista/Imovirtual/OLX) + FSBO no CRM + digest 08:30.
-- Medição vitalícia: market_listings guarda histórico para sempre (alimenta ACMs e posts de Autoridade).

-- 1) Tabela de mercado (histórico permanente das angariações vistas nos portais)
create table if not exists public.market_listings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  portal text not null,                          -- idealista | imovirtual | olx | ...
  external_id text,                              -- id do anúncio no portal
  url text not null,
  listing_hash text not null,                    -- chave de dedup (portal + external_id, senão url)
  title text,
  price numeric,
  price_currency text not null default 'EUR',
  tipologia text,                                -- T0..T6
  property_type text,                            -- apartamento|moradia|terreno|loja|armazem|predio|garagem|escritorio|quinta|outro
  operation text not null default 'venda',       -- venda|arrendamento
  area numeric,                                  -- m2
  rooms integer,
  bathrooms integer,
  freguesia text,
  concelho text not null default 'Maia',
  advertiser_type text not null default 'desconhecido',   -- particular|agencia|desconhecido
  advertiser_name text,
  advertiser_phone text,                         -- E.164 quando disponível
  latitude numeric,
  longitude numeric,
  published_at date,                             -- data de publicação/actualização no portal (quando disponível)
  first_seen timestamptz not null default now(), -- primeira vez que o radar viu este anúncio
  last_seen timestamptz not null default now(),  -- última vez visto (activo)
  days_on_market integer,                        -- dias no mercado (do portal, senão calculado de first_seen)
  status text not null default 'active',         -- active|removed
  last_price numeric,                            -- preço anterior (para detecção de reduções)
  price_drop_pct numeric,                        -- % da última redução detectada (positivo = desceu)
  price_history jsonb not null default '[]'::jsonb,  -- [{price, at}]
  fsbo_deal_id uuid references public.deals(id) on delete set null,      -- negócio criado se for particular
  fsbo_contact_id uuid references public.contacts(id) on delete set null,
  raw jsonb,                                     -- registo bruto do portal (auditoria)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_listings_org_hash_uniq unique (organization_id, listing_hash)
);

create index if not exists market_listings_org_first_seen_idx on public.market_listings (organization_id, first_seen desc);
create index if not exists market_listings_org_portal_idx     on public.market_listings (organization_id, portal);
create index if not exists market_listings_org_adv_idx        on public.market_listings (organization_id, advertiser_type);
create index if not exists market_listings_org_freg_idx       on public.market_listings (organization_id, freguesia);
create index if not exists market_listings_org_status_idx     on public.market_listings (organization_id, status);

comment on table public.market_listings is 'Brief 6 Radar Maia: anúncios de imóveis vistos nos portais (mercado externo). Histórico permanente (medição vitalícia). NÃO confundir com public.imoveis (imóveis geridos pelo João).';

-- updated_at automático
drop trigger if exists set_market_listings_updated_at on public.market_listings;
create trigger set_market_listings_updated_at
  before update on public.market_listings
  for each row execute function public.set_updated_at();

-- RLS: membros da org lêem; escrita só service-role (o radar corre com service role e filtra por org).
alter table public.market_listings enable row level security;

drop policy if exists market_listings_select_org on public.market_listings;
create policy market_listings_select_org on public.market_listings
  for select using (organization_id = public.get_user_org_id());

-- 2) Token da Apify (chave do João) — guardado na BD como as outras chaves (AI/Telegram)
alter table public.organization_settings add column if not exists apify_token text;
comment on column public.organization_settings.apify_token is 'Brief 6: token de API da Apify (conta do João) usado pela rota /api/radar-maia/run para a recolha diária. Server-only.';

-- 3) Registo em /automacoes (aparece como cartão com contadores). Cron criado após deploy da rota.
insert into public.system_automations
  (key, name, description, icon, cron_job_name, cron_expression, function_url, enabled, params)
values
  ('radar-maia',
   'Radar Maia — novas casas + FSBO (08:30)',
   'Todos os dias (2ª-6ª e sábado) recolhe as novas entradas no mercado da Maia nos portais (Apify), guarda em market_listings, cria os particulares (FSBO) no CRM em cadência, e envia o resumo das 08:30 (email + Telegram) com medianas por freguesia, FSBO novos e sinais (reduções de preço, angariações paradas 90+ dias).',
   '🛰️',
   'radar-maia',
   '30 7 * * 1-6',
   'https://crm.joaofilipefonseca.pt/api/radar-maia/run',
   true,
   '{"portais": ["idealista", "imovirtual", "olx"], "max_por_portal": 150, "janela_horas": 48}'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  cron_expression = excluded.cron_expression,
  function_url = excluded.function_url,
  params = excluded.params;
