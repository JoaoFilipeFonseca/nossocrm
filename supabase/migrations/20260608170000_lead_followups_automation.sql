-- CT-AUTO Fase 2b — automação "Leva de follow-up".
-- Função de marcação (cooldown) + registo em /automacoes + pg_cron (seg-sáb 09h, nunca domingo).
-- Idempotente.

-- Marca os negocios da leva com followupQueuedOn (cooldown) — chamada pela edge depois de
-- criar as tarefas, para nunca duplicar.
create or replace function public.mark_deals_followup_queued(p_deal_ids uuid[], p_day date)
returns void
language sql
security definer
set search_path = public
as $$
  update public.deals
    set custom_fields = coalesce(custom_fields, '{}'::jsonb)
      || jsonb_build_object('followupQueuedOn', p_day::text)
    where id = any(p_deal_ids);
$$;

revoke all on function public.mark_deals_followup_queued(uuid[], date) from public, anon;
grant execute on function public.mark_deals_followup_queued(uuid[], date) to service_role;

-- Registo em /automacoes (system_automations).
insert into public.system_automations
  (key, name, description, icon, cron_job_name, cron_expression, function_url, enabled, params)
values
  ('lead-followups',
   'Leva de follow-up (nunca perder uma lead)',
   'Seg a Sáb às 09h: escolhe a leva diária de negócios a retomar (por probabilidade, com rede de segurança para nunca esquecer nenhum), cria uma tarefa "Retomar contacto" por cada um e envia um resumo no Telegram. Negócios adiados ficam de fora até à data; cada lead volta à leva ao fim do período (cooldown).',
   '🔔',
   'lead-followups',
   '0 9 * * 1-6',
   'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/lead-followups',
   true,
   '{"skip_sundays": true}'::jsonb)
on conflict (key) do nothing;

do $$
begin
  perform cron.unschedule('lead-followups');
exception when others then null;
end $$;

select cron.schedule(
  'lead-followups',
  '0 9 * * 1-6',
  $cmd$
    select net.http_post(
      url := 'https://zcqbbqrdbszzkpydrlmz.supabase.co/functions/v1/lead-followups',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Cron-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'backup_cron_secret' limit 1)
      ),
      body := '{}'::jsonb
    );
  $cmd$
);
