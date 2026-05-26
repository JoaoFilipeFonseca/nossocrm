-- ============================================================================
-- Cron job para retoma de execuções suspensas
-- Sprint 1.2, commit 3 de 4.
--
-- A cada minuto invoca a Edge Function automation-resume via pg_net.http_post.
-- A função lê automation_schedules pending+due, marca 'fired' e invoca
-- automation-execute em modo resume por cada schedule.
--
-- Idempotente: faz unschedule antes de schedule se já existir o job pelo nome.
-- ============================================================================

DO $$
DECLARE
  v_job_id BIGINT;
BEGIN
  SELECT jobid INTO v_job_id FROM cron.job WHERE jobname = 'automation-resume-tick';
  IF v_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_job_id);
  END IF;
END
$$;

SELECT cron.schedule(
  'automation-resume-tick',
  '* * * * *',
  $cron$
    SELECT net.http_post(
      url := 'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/automation-resume',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'automation_cron_secret' LIMIT 1)
      ),
      body := '{}'::jsonb
    );
  $cron$
);
