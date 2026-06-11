-- ============================================================================
-- MKT-SEQUENCES Fatia 1 (11/06/2026) — base RGPD para emails de automação
--   1. contacts.email_opt_out: o contacto pediu para não receber mais emails.
--   2. organization_settings.privacy_policy_url: link da política de
--      privacidade por organização (fallback no código).
--   3. Secret 'email_unsubscribe_secret' no Vault + RPC service_role para o
--      átomo action.send_email assinar links de anular subscrição (HMAC).
-- Idempotente.
-- ============================================================================

alter table public.contacts
  add column if not exists email_opt_out boolean not null default false;

comment on column public.contacts.email_opt_out is
'RGPD: true = o contacto anulou a subscrição de emails (página /unsubscribe). Os átomos de envio de email recusam enviar.';

alter table public.organization_settings
  add column if not exists privacy_policy_url text;

comment on column public.organization_settings.privacy_policy_url is
'Link da política de privacidade usado no rodapé RGPD dos emails de automação. NULL = fallback do código.';

-- Secret para assinar tokens de anular subscrição (criar só se não existe).
do $$
declare
  v_existing text;
begin
  select decrypted_secret into v_existing
  from vault.decrypted_secrets where name = 'email_unsubscribe_secret' limit 1;
  if v_existing is null then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'email_unsubscribe_secret',
      'MKT-SEQUENCES: assina (HMAC) os links de anular subscrição no rodapé dos emails de automação.'
    );
  end if;
end $$;

create or replace function public.get_email_unsubscribe_secret()
returns text
language sql
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'email_unsubscribe_secret' limit 1;
$$;

revoke all on function public.get_email_unsubscribe_secret() from public, anon, authenticated;

comment on function public.get_email_unsubscribe_secret() is
'MKT-SEQUENCES: lido pelos átomos action.send_email (service_role) e pela rota /api/email/unsubscribe para assinar/validar tokens. Nunca expor a anon/authenticated.';
