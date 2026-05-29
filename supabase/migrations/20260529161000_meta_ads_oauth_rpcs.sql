-- Épico Meta Ads — Fase A, Commit 2 — RPCs de acesso ao Vault para o OAuth
-- ============================================================================
-- O schema `vault` não está exposto ao PostgREST (acesso server-only). Estas
-- RPCs SECURITY DEFINER expõem, e SÓ ao service_role:
--   1) leitura das credenciais da app Meta (meta_app_id / meta_app_secret),
--   2) guardar/actualizar o token OAuth de longa duração por integração,
--   3) ler esse token (usado pela edge function do webhook na Fase A, c3).
--
-- Token nunca em texto simples no schema public: vive no Vault.
-- search_path fixo a '' + revoke de public/anon/authenticated (defesa em
-- profundidade). Migração idempotente (CREATE OR REPLACE).
-- ============================================================================

-- 1) Credenciais da app Meta (App ID + App Secret) — já estão no Vault.
CREATE OR REPLACE FUNCTION public.get_meta_app_credentials()
RETURNS TABLE(app_id text, app_secret text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'meta_app_id'     LIMIT 1),
    (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'meta_app_secret' LIMIT 1);
$$;

-- 2) Guardar/actualizar o token OAuth por integração (upsert por nome).
CREATE OR REPLACE FUNCTION public.meta_oauth_store_token(p_name text, p_token text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
  IF v_id IS NULL THEN
    v_id := vault.create_secret(p_token, p_name, 'Token OAuth Meta (epico Meta Ads)');
  ELSE
    PERFORM vault.update_secret(v_id, p_token);
  END IF;
  RETURN v_id;
END;
$$;

-- 3) Ler o token OAuth por nome (server/edge, service_role).
CREATE OR REPLACE FUNCTION public.meta_oauth_read_token(p_name text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = p_name LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_meta_app_credentials()                FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.meta_oauth_store_token(text, text)        FROM public, anon, authenticated;
REVOKE ALL ON FUNCTION public.meta_oauth_read_token(text)               FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_meta_app_credentials()             TO service_role;
GRANT EXECUTE ON FUNCTION public.meta_oauth_store_token(text, text)     TO service_role;
GRANT EXECUTE ON FUNCTION public.meta_oauth_read_token(text)            TO service_role;
