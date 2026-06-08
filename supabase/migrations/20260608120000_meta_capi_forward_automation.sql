-- MA-CAPI fatia 2 (tail) — agenda o reenvio de negócios ganhos à Meta e regista
-- em /automacoes. De 30 em 30 min: a rota Vercel `capi-forward` varre os negócios
-- ganhos recentes (<=7 dias, idempotente) e envia a comissão líquida ao dataset
-- "João Fonseca Online" (API de Conversões), reutilizando o token do Vault.
-- Espelha 20260529201000_meta_ads_analyst_automation.sql (pg_cron -> rota Next +
-- system_automations). Usa o domínio canónico (evita o redirect 307 da vercel.app).

insert into public.system_automations
  (key, name, description, icon, cron_job_name, cron_expression, function_url, enabled, params)
values
  ('meta-capi-forward',
   'Conversões para a Meta (negócio ganho)',
   'De 30 em 30 minutos: envia à Meta (API de Conversões) os negócios marcados como ganhos nos últimos 7 dias, com o valor da comissão líquida. Ajuda a Meta a entregar os anúncios a quem tem mais probabilidade de comprar. Idempotente (não envia o mesmo negócio duas vezes) e nunca dispara o histórico.',
   '📤',
   'meta-capi-forward',
   '*/30 * * * *',
   'https://crm.joaofilipefonseca.pt/api/meta-ads/capi-forward',
   true,
   '{}'::jsonb)
on conflict (key) do nothing;

do $$
begin
  perform cron.unschedule('meta-capi-forward');
exception when others then null;
end $$;

select cron.schedule(
  'meta-capi-forward',
  '*/30 * * * *',
  $cmd$
    select net.http_post(
      url := 'https://crm.joaofilipefonseca.pt/api/meta-ads/capi-forward',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret' limit 1)
      ),
      body := '{}'::jsonb
    );
  $cmd$
);
