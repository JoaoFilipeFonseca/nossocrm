-- BRIEF 7 / 7b — Nurture por email com fila de aprovação + segmentação da base.
--
-- Três peças, todas idempotentes:
--   1. Segmento por contacto (5 tipos) em colunas próprias de `contacts`.
--   2. Tabela `nurture_emails` — a fila de aprovação (state machine) + movimento.
--   3. Registo em `system_automations` (key 'nurture-email') para aparecer em
--      /automacoes com contador (regra: toda automação aparece no CRM).
--
-- Nada é enviado por esta migração. Os emails só saem quando o João aprova na UI.

-- ===========================================================================
-- 1. SEGMENTO POR CONTACTO
-- ===========================================================================
-- 5 segmentos (Brief 7): proprietario_vendedor, comprador, ex_cliente,
-- referenciador, curioso. A IA sugere; o João corrige inline (segment_set_by).

alter table public.contacts
  add column if not exists segment text,
  add column if not exists segment_set_by text,          -- 'ai' | 'human'
  add column if not exists segment_rationale text,        -- 1 linha: porquê
  add column if not exists segment_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contacts_segment_check'
  ) then
    alter table public.contacts
      add constraint contacts_segment_check
      check (segment is null or segment in (
        'proprietario_vendedor', 'comprador', 'ex_cliente', 'referenciador', 'curioso'
      ));
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'contacts_segment_set_by_check'
  ) then
    alter table public.contacts
      add constraint contacts_segment_set_by_check
      check (segment_set_by is null or segment_set_by in ('ai', 'human'));
  end if;
end $$;

create index if not exists idx_contacts_segment
  on public.contacts (organization_id, segment) where deleted_at is null;

-- ===========================================================================
-- 2. FILA DE NURTURE (nurture_emails)
-- ===========================================================================
create table if not exists public.nurture_emails (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  contact_id uuid not null references public.contacts(id) on delete cascade,
  deal_id uuid references public.deals(id) on delete set null,

  segment text not null,
  wave text not null,                 -- ex.: 'reactivacao-2026-q3'
  step integer not null default 1,    -- passo da sequência (1..3)

  to_email text not null,
  subject text not null,
  body_text text not null,
  body_html text,

  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'sent', 'failed', 'skipped')),

  generated_by text not null default 'ai',   -- 'ai' | 'fallback'
  personalization jsonb not null default '{}'::jsonb,

  channel_id uuid references public.messaging_channels(id) on delete set null,
  external_message_id text,           -- id devolvido pelo Resend (casar com webhook)
  error text,

  -- movimento (Brief 7.4): sobe na Power List do dia seguinte
  opened_at timestamptz,
  clicked_at timestamptz,
  replied_at timestamptz,

  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  sent_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Um passo de uma onda por contacto (idempotência: não gerar/enviar 2x).
create unique index if not exists uniq_nurture_contact_wave_step
  on public.nurture_emails (contact_id, wave, step);

create index if not exists idx_nurture_pending
  on public.nurture_emails (organization_id, created_at) where status = 'pending';

create index if not exists idx_nurture_status
  on public.nurture_emails (organization_id, status);

create index if not exists idx_nurture_external_id
  on public.nurture_emails (external_message_id) where external_message_id is not null;

-- movimento recente (para a Power List juntar reacções das últimas 48h)
create index if not exists idx_nurture_reacted
  on public.nurture_emails (organization_id, contact_id)
  where opened_at is not null or clicked_at is not null or replied_at is not null;

-- updated_at automático
create or replace function public.tg_nurture_emails_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_nurture_emails_touch on public.nurture_emails;
create trigger trg_nurture_emails_touch
  before update on public.nurture_emails
  for each row execute function public.tg_nurture_emails_touch();

-- RLS: leitura/escrita só dentro da própria organização; service_role ignora RLS.
alter table public.nurture_emails enable row level security;
alter table public.nurture_emails force row level security;

drop policy if exists nurture_emails_select_own_org on public.nurture_emails;
create policy nurture_emails_select_own_org on public.nurture_emails
  for select to authenticated
  using (organization_id = public.get_user_org_id());

drop policy if exists nurture_emails_insert_own_org on public.nurture_emails;
create policy nurture_emails_insert_own_org on public.nurture_emails
  for insert to authenticated
  with check (organization_id = public.get_user_org_id());

drop policy if exists nurture_emails_update_own_org on public.nurture_emails;
create policy nurture_emails_update_own_org on public.nurture_emails
  for update to authenticated
  using (organization_id = public.get_user_org_id())
  with check (organization_id = public.get_user_org_id());

drop policy if exists nurture_emails_delete_own_org on public.nurture_emails;
create policy nurture_emails_delete_own_org on public.nurture_emails
  for delete to authenticated
  using (organization_id = public.get_user_org_id());

-- ===========================================================================
-- 3. REGISTO EM /automacoes
-- ===========================================================================
-- A fila é controlada pelo João na UI (Mensagens › Nurture): nada sai sem
-- aprovação. O botão "Enviar aprovados" chama /api/nurture/send de imediato.
-- Além disso há um despachante diário (10h UTC, 2ª a Sábado, NUNCA Domingo)
-- que envia os que já estiverem aprovados — idempotente (só approved → sent).
-- A linha em system_automations faz o cartão aparecer em /automacoes com
-- contador (a rota incrementa run_count/fail_count a cada onda).
insert into public.system_automations
  (key, name, description, icon, cron_job_name, cron_expression, function_url, enabled, params)
values
  ('nurture-email',
   'Nurture por email (fila de aprovação)',
   'Toques periódicos personalizados à base, por segmento. A IA prepara os emails no tom da marca; nada sai sem a aprovação do João na fila (Mensagens › Nurture). Só saem os aprovados, com anular subscrição e nunca ao Domingo. Reacções (abriu/clicou) sobem o contacto na Power List do dia seguinte.',
   '🌱',
   'nurture-email',
   '0 10 * * 1-6',
   'https://crm.joaofilipefonseca.pt/api/nurture/send',
   true,
   '{"never_sunday": true, "wave": "reactivacao-2026-q3"}'::jsonb)
on conflict (key) do update set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  cron_job_name = excluded.cron_job_name,
  cron_expression = excluded.cron_expression,
  function_url = excluded.function_url,
  params = excluded.params;

do $$
begin
  perform cron.unschedule('nurture-email');
exception when others then null;
end $$;

select cron.schedule(
  'nurture-email',
  '0 10 * * 1-6',
  $cmd$
    select net.http_post(
      url := 'https://crm.joaofilipefonseca.pt/api/nurture/send',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret' limit 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 55000
    );
  $cmd$
);
