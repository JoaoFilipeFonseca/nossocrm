alter table public.organization_settings
  add column if not exists telegram_pending_action jsonb;

comment on column public.organization_settings.telegram_pending_action is
  'Accao pendente do bot Telegram quando classificacao foi ambigua. JSON: { type, text, suggested_kind, summary, created_at }. TTL aplicacional 10 min.';
