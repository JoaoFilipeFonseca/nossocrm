-- Sprint 22 c1: cron seg-sex 7h UTC para briefing matinal Telegram.
-- Edge function tem dedupe weekend interno (Lisbon TZ), mas o cron schedule
-- limita aos dias 1-5 (segunda a sexta).

select cron.schedule(
  'telegram-morning-brief',
  '0 7 * * 1-5',
  $$
    select net.http_post(
      url := 'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/telegram-morning-brief',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret' limit 1)
      ),
      body := '{}'::jsonb
    );
  $$
);
