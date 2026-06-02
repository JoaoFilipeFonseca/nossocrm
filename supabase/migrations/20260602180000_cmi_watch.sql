-- IMO-6 Fase 2b passo 2 — automação "Vigia de CMI".
-- Coluna de dedup diário + registo em /automacoes + pg_cron (seg-sáb 09h, nunca domingo).
-- Idempotente.

-- Dedup diário: marca o dia (Lisboa) em que o CMI foi alertado.
alter table public.imovel_cmi
  add column if not exists last_watch_alert_on date;

-- Registo em /automacoes (system_automations).
insert into public.system_automations
  (key, name, description, icon, cron_job_name, cron_expression, function_url, enabled, params)
values
  ('cmi-watch',
   'Vigia de CMI',
   'Seg a Sáb às 09h: percorre os CMIs activos e alerta no Telegram os imóveis em risco (CMI a terminar/expirado ou imóvel parado: sem visitas e sem propostas), com sugestão de acção. Dedup diário para não repetir.',
   '📋',
   'cmi-watch',
   '0 9 * * 1-6',
   'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/cmi-watch',
   true,
   '{"alerta_fim_dias": 15, "sem_visita_dias": 21, "skip_sundays": true}'::jsonb)
on conflict (key) do nothing;

do $$
begin
  perform cron.unschedule('cmi-watch');
exception when others then null;
end $$;

select cron.schedule(
  'cmi-watch',
  '0 9 * * 1-6',
  $cmd$
    select net.http_post(
      url := 'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/cmi-watch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret' limit 1)
      ),
      body := '{}'::jsonb
    );
  $cmd$
);
