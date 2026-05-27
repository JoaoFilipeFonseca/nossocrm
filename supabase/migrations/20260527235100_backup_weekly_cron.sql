-- Sprint 15 c1: schedule semanal do backup. Domingo 03:00 UTC (= 03h00 Lisbon
-- inverno / 04h00 Lisbon verão) — janela 3-4h da madrugada de Domingo.

select cron.schedule(
  'backup-weekly',
  '0 3 * * 0',
  $$
    select net.http_post(
      url := 'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/backup-export',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret' limit 1)
      ),
      body := '{}'::jsonb
    );
  $$
);
