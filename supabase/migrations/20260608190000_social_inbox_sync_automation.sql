-- SOCIAL-INBOX — automação de sincronização das DMs do Messenger.
-- Registo em /automacoes + pg_cron a cada 15 min (todos os dias — uma DM a qualquer hora
-- precisa de resposta dentro da janela de 24h). Chama a rota Next /api/social-inbox/sync.
-- Idempotente.

insert into public.system_automations
  (key, name, description, icon, cron_job_name, cron_expression, function_url, enabled, params)
values
  ('social-inbox-sync',
   'Caixa Social (DMs do Messenger)',
   'A cada 15 minutos: puxa as conversas de DMs do Facebook Messenger da Página, marca as que precisam de resposta e avisa no Telegram as novas (sem repetir). A IA prepara o rascunho na Caixa Social; o João revê e envia sempre. Instagram chega a seguir.',
   '💬',
   'social-inbox-sync',
   '*/15 * * * *',
   'https://crm.joaofilipefonseca.pt/api/social-inbox/sync',
   true,
   '{}'::jsonb)
on conflict (key) do nothing;

do $$
begin
  perform cron.unschedule('social-inbox-sync');
exception when others then null;
end $$;

select cron.schedule(
  'social-inbox-sync',
  '*/15 * * * *',
  $cmd$
    select net.http_post(
      url := 'https://crm.joaofilipefonseca.pt/api/social-inbox/sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret' limit 1)
      ),
      body := '{}'::jsonb
    );
  $cmd$
);
