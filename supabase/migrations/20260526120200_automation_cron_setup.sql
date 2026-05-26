-- ============================================================================
-- Sprint 1.0 commit 4 de 5, pg_cron + RPC para o cron secret
--
-- Cria:
--   1. RPC public.get_automation_cron_secret() que devolve o secret guardado
--      em vault. Restringida a service_role para a Edge Function ler.
--   2. Cron job automation-event-listener-tick que invoca a Edge Function
--      a cada minuto via pg_net.http_post, lendo o secret directamente de
--      vault.decrypted_secrets (cron corre como superuser, tem acesso).
--
-- Pré-requisito: secret 'automation_cron_secret' já existe em vault (criado
-- por SELECT vault.create_secret(...) antes desta migration).
--
-- Idempotente: usa CREATE OR REPLACE e un schedule por nome (substitui se já
-- existe via cron.unschedule no caso de existir).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_automation_cron_secret()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = vault, public
AS $$
  SELECT decrypted_secret
  FROM vault.decrypted_secrets
  WHERE name = 'automation_cron_secret'
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_automation_cron_secret() IS
  'Devolve o cron secret usado pela Edge Function automation-event-listener. Apenas service_role pode executar.';

REVOKE EXECUTE ON FUNCTION public.get_automation_cron_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_automation_cron_secret() TO service_role;

-- ----------------------------------------------------------------------------
-- Schedule o cron job (substitui se já existir)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'automation-event-listener-tick';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END
$$;

SELECT cron.schedule(
  'automation-event-listener-tick',
  '* * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/automation-event-listener',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'automation_cron_secret' LIMIT 1)
      ),
      body := '{}'::jsonb
    );
  $cron$
);
