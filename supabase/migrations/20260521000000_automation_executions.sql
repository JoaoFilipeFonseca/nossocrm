-- =====================================================
-- #127 Logs de Automações — Bloco 1 Sub-task 4
-- Tabela vazia inicialmente; alimentada quando o engine
-- de automações (#123) existir em bloco posterior.
-- Aplicado: 21 Mai 2026
-- =====================================================

create table if not exists public.automation_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade not null,
  automation_id uuid,
  trigger_kind text,
  deal_id uuid references public.deals(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete set null,
  step_index integer,
  step_type text,
  status text not null,
  error_message text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  processed_at timestamptz
);

create index if not exists idx_automation_executions_org_created
  on public.automation_executions(organization_id, created_at desc);
create index if not exists idx_automation_executions_deal
  on public.automation_executions(deal_id)
  where deal_id is not null;
create index if not exists idx_automation_executions_status
  on public.automation_executions(status);

alter table public.automation_executions enable row level security;

create policy "automation_executions: org read"
  on public.automation_executions for select
  using (organization_id = get_user_org_id());

create policy "automation_executions: org write"
  on public.automation_executions for all
  using (organization_id = get_user_org_id())
  with check (organization_id = get_user_org_id());

comment on table public.automation_executions is
  'Log de execuções do engine de automações (#123). Permite ao João ver o que foi disparado, ignorado ou falhou.';
comment on column public.automation_executions.status is
  'processado | ignorado | falhou | pausado_humano';
comment on column public.automation_executions.trigger_kind is
  'stage_enter | tag_added | tag_removed | task_completed | time_in_stage';
comment on column public.automation_executions.step_type is
  'whatsapp | sms | email | task | tag | pause';
