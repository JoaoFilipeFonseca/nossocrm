-- Sprint 25 c1: cron 5min para alertar rajadas de erros front-end via Telegram.
select cron.schedule(
  'client-errors-alert',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/client-errors-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret' limit 1)
      ),
      body := '{}'::jsonb
    );
  $$
);
