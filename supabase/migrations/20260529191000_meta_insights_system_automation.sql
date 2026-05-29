-- Meta Ads Fase B (b1) — regista o sync de métricas em /automacoes (regra crítica:
-- memory/regra_automacoes_no_crm.md). Cron diário às 06h00, gerível sem código.

insert into public.system_automations
  (key, name, description, icon, cron_job_name, cron_expression, function_url, enabled, params)
values
  ('meta-insights-sync',
   'Sincronizar métricas Meta Ads',
   'Diário: lê os insights por anúncio (custo, impressões, cliques, leads) da conta Meta ligada e guarda em ad_insights. Base do painel de CPL/CPA/ROAS.',
   '📊',
   'meta-insights-sync',
   '0 6 * * *',
   'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/automation-meta-insights',
   true,
   '{"lookback_days": 7}'::jsonb)
on conflict (key) do nothing;

-- Agenda o cron (idempotente: desagenda primeiro se já existir).
do $$
begin
  perform cron.unschedule('meta-insights-sync');
exception when others then null;
end $$;

select cron.schedule(
  'meta-insights-sync',
  '0 6 * * *',
  $cmd$
    select net.http_post(
      url := 'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/automation-meta-insights',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret' limit 1)
      ),
      body := '{}'::jsonb
    );
  $cmd$
);
