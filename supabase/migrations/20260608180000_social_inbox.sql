-- SOCIAL-INBOX MVP (Messenger) — modelo de dados.
-- Conversas e mensagens de DMs do Facebook Messenger (e Instagram, fast-follow) puxadas
-- da Graph API. A IA prepara rascunho; o João revê e envia sempre (HITL total).
-- RLS por org (leitura própria org; escrita por service_role, como as automation_*). Idempotente.

create table if not exists public.social_conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_id uuid,
  platform text not null default 'messenger',          -- messenger | instagram
  thread_id text not null,                              -- id da conversa na Meta
  participant_id text,                                  -- PSID/IGSID do utilizador
  participant_name text,
  last_message_at timestamptz,
  last_snippet text,
  last_from text,                                       -- them | us
  message_count int default 0,
  needs_response boolean not null default false,
  status text not null default 'open',                 -- open | handled | ignored
  is_noise boolean not null default false,
  contact_id uuid references public.contacts(id) on delete set null,
  deal_id uuid references public.deals(id) on delete set null,
  ai_draft text,
  ai_draft_at timestamptz,
  alerted_at timestamptz,                               -- dedup do aviso Telegram
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, platform, thread_id)
);

create table if not exists public.social_messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.social_conversations(id) on delete cascade,
  platform text not null default 'messenger',
  message_id text,                                      -- mid da Meta
  from_side text not null,                              -- them | us
  body text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (organization_id, message_id)
);

create index if not exists idx_social_conv_org_status
  on public.social_conversations (organization_id, status, needs_response);
create index if not exists idx_social_msg_conv
  on public.social_messages (conversation_id, sent_at);

alter table public.social_conversations enable row level security;
alter table public.social_messages enable row level security;

-- Leitura: só a própria org. Escrita: service_role (o sync corre com service-role).
drop policy if exists social_conv_select_own_org on public.social_conversations;
create policy social_conv_select_own_org on public.social_conversations
  for select using (organization_id = public.get_user_org_id());

drop policy if exists social_conv_update_own_org on public.social_conversations;
create policy social_conv_update_own_org on public.social_conversations
  for update using (organization_id = public.get_user_org_id())
  with check (organization_id = public.get_user_org_id());

drop policy if exists social_msg_select_own_org on public.social_messages;
create policy social_msg_select_own_org on public.social_messages
  for select using (organization_id = public.get_user_org_id());

grant select, update on public.social_conversations to authenticated;
grant select on public.social_messages to authenticated;
