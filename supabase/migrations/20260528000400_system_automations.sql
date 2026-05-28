-- Sprint 27 c1: tabela das automações de SISTEMA visíveis em /automacoes.
-- REGRA CRÍTICA (memory/regra_automacoes_no_crm.md): toda automação tem que
-- aparecer aqui para o João editar/desligar sem código.

create table if not exists public.system_automations (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  description text,
  icon text default '⚙️',
  cron_job_name text not null,
  cron_expression text not null,
  function_url text not null,
  enabled boolean not null default true,
  params jsonb not null default '{}'::jsonb,
  last_run_at timestamptz,
  last_run_ok boolean,
  last_run_error text,
  run_count int not null default 0,
  fail_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.system_automations_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists trg_system_automations_updated_at on public.system_automations;
create trigger trg_system_automations_updated_at
  before update on public.system_automations
  for each row execute function public.system_automations_set_updated_at();

alter table public.system_automations enable row level security;

drop policy if exists "any authenticated read system_automations" on public.system_automations;
create policy "any authenticated read system_automations" on public.system_automations
  for select to authenticated using (true);

insert into public.system_automations (key, name, description, icon, cron_job_name, cron_expression, function_url, enabled, params)
values
  ('backup-weekly',
   'Backup automático semanal',
   'Dump JSON de todas as tabelas críticas para o bucket privado backups/. Retenção: 12 backups.',
   '💾',
   'backup-weekly',
   '0 3 * * 0',
   'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/backup-export',
   true,
   '{"retention": 12}'::jsonb),
  ('telegram-morning-brief',
   'Briefing matinal Telegram',
   'Mensagem diária seg-sex com CHQ semana, propostas, receita ponderada, meta YTD e deals frios.',
   '☀️',
   'telegram-morning-brief',
   '0 7 * * 1-5',
   'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/telegram-morning-brief',
   true,
   '{"skip_weekends": true}'::jsonb),
  ('client-errors-alert',
   'Alerta rajada de erros',
   'A cada 5 min: se há ≥ N erros front-end novos numa janela, dispara Telegram.',
   '⚠️',
   'client-errors-alert',
   '*/5 * * * *',
   'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/client-errors-alert',
   true,
   '{"threshold": 3, "window_minutes": 5}'::jsonb)
on conflict (key) do nothing;

comment on table public.system_automations is 'Sprint 27 c1: registo visível das automações operacionais do CRM. Cada feature nova de automação TEM de aparecer aqui (regra crítica do produto, ver memory/regra_automacoes_no_crm.md).';
