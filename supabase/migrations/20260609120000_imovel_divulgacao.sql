-- IMO-7 Fase 1 — Agente de Divulgação do Imóvel.
-- Histórico VERSIONADO do plano de divulgação por imóvel: cada "Gerar" cria uma versão nova
-- (nunca sobrescreve) para o João comparar e para a IA aprender o que resulta
-- (medição vitalícia — reter histórico sempre).
--
-- jsonb extensível: Fase 1 enche comprador_ideal + copy_canais; Fase 2 fotos_ordem; Fase 3 plano.

create table if not exists public.imovel_divulgacao (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  imovel_id uuid not null references public.imoveis(id) on delete cascade,
  versao integer not null default 1,
  comprador_ideal jsonb,   -- { perfis: string[], angulo: string }
  copy_canais jsonb,       -- { remax:{titulo,corpo}, idealista:{titulo,corpo}, meta:{titulo,corpo,cta} }
  fotos_ordem jsonb,       -- Fase 2 (sequência de fotos por IA de visão)
  plano jsonb,             -- Fase 3 (plano passo a passo)
  modelo text,             -- etiqueta do provider de IA usado
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists imovel_divulgacao_imovel_versao_idx
  on public.imovel_divulgacao (imovel_id, versao desc);
create index if not exists imovel_divulgacao_org_idx
  on public.imovel_divulgacao (organization_id);

alter table public.imovel_divulgacao enable row level security;

-- Leitura: só a própria organização (escritas vão por service-role na rota).
drop policy if exists imovel_divulgacao_select_own_org on public.imovel_divulgacao;
create policy imovel_divulgacao_select_own_org on public.imovel_divulgacao
  for select using (organization_id = public.get_user_org_id());

grant select on public.imovel_divulgacao to authenticated;
grant all on public.imovel_divulgacao to service_role;
