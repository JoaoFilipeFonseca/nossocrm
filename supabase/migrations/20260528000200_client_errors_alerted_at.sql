-- Sprint 25 c1: campo alerted_at para evitar reenviar alerta sobre os mesmos
-- erros. Indice parcial em (org, created_at) WHERE alerted_at IS NULL para
-- a edge function de alerta varrer rapidamente apenas as linhas pendentes.
alter table public.client_errors
  add column if not exists alerted_at timestamptz;

create index if not exists idx_client_errors_unalerted
  on public.client_errors (organization_id, created_at)
  where alerted_at is null;
