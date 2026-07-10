-- Brief 6 — Cron do Radar Maia: 08:30 Lisboa (verão), 2a-6a + sabado.
-- Chama a rota Vercel /api/radar-maia/run (que completa server-side mesmo que o
-- cliente pg_net expire; grava a corrida em system_automations).
do $$
begin
  perform cron.unschedule('radar-maia');
exception when others then null;
end $$;

select cron.schedule(
  'radar-maia',
  '30 7 * * 1-6',
  $cmd$
    select net.http_post(
      url := 'https://crm.joaofilipefonseca.pt/api/radar-maia/run',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret' limit 1)
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $cmd$
);
