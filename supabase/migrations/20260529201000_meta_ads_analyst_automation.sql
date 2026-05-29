-- Meta Ads Fase B (b2.3) — regista o analista IA diário em /automacoes.
-- Corre às 07h (depois do sync de métricas das 06h, para analisar dados frescos).
-- function_url aponta para a rota Next (reusa a infra de IA do CRM).

insert into public.system_automations
  (key, name, description, icon, cron_job_name, cron_expression, function_url, enabled, params)
values
  ('meta-ads-analyst',
   'Analista IA dos anúncios',
   'Diário às 07h: analisa cada anúncio (CPL, CTR, tendência) e dá veredicto (parar/aumentar/testar/manter). Decisões firmes aos 3/5/8 dias de dados; nos outros dias alerta no Telegram se houver anomalia. Resultados em /anuncios.',
   '🧠',
   'meta-ads-analyst',
   '0 7 * * *',
   'https://crm-joao.vercel.app/api/meta-ads/analyze',
   true,
   '{}'::jsonb)
on conflict (key) do nothing;

do $$
begin
  perform cron.unschedule('meta-ads-analyst');
exception when others then null;
end $$;

select cron.schedule(
  'meta-ads-analyst',
  '0 7 * * *',
  $cmd$
    select net.http_post(
      url := 'https://crm-joao.vercel.app/api/meta-ads/analyze',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret' limit 1)
      ),
      body := '{}'::jsonb
    );
  $cmd$
);
