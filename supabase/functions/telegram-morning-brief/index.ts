// Sprint 22 c1: briefing matinal automático Telegram (seg-sex).
// Para cada org com telegram_crm_bot_token + telegram_crm_chat_id, envia
// resumo do dia: CHQ semana, propostas abertas, gap meta, deals frios.
//
// Auth: X-Cron-Secret == backup_cron_secret (reusado para não multiplicar).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { loadAutomationParams } from '../_shared/automation-params.ts';
import { recordAutomationRun } from '../_shared/record-run.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TELEGRAM_API = 'https://api.telegram.org';
const DEFAULTS = { skip_weekends: true, cold_deals_days: 10 };

function fmt(n: number): string {
  return Math.round(n).toLocaleString('pt-PT');
}

Deno.serve(async (req: Request) => {
  const cronSecret = req.headers.get('X-Cron-Secret') || '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: expectedSecret } = await supabase.rpc('get_backup_cron_secret');
  if (!expectedSecret || cronSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } });
  }

  const params = await loadAutomationParams(supabase, 'telegram-morning-brief', DEFAULTS);
  const skipWeekends = params.skip_weekends !== false;
  const coldDealsDays = Math.max(1, Math.floor(Number(params.cold_deals_days) || DEFAULTS.cold_deals_days));

  const now = new Date();
  if (skipWeekends) {
    const lisbonStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', weekday: 'short' }).format(now);
    const dayLower = lisbonStr.toLowerCase();
    if (dayLower.startsWith('sat') || dayLower.startsWith('sun')) {
      return new Response(JSON.stringify({ ok: true, skipped: 'weekend' }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
  }

  const { data: orgs, error: orgsErr } = await supabase
    .from('organization_settings')
    .select('organization_id, telegram_crm_bot_token, telegram_crm_chat_id')
    .not('telegram_crm_bot_token', 'is', null)
    .not('telegram_crm_chat_id', 'is', null);

  if (orgsErr) {
    await recordAutomationRun(supabase, 'telegram-morning-brief', false, orgsErr.message);
    return new Response(JSON.stringify({ error: orgsErr.message }), { status: 500, headers: { 'content-type': 'application/json' } });
  }

  const sent: Array<{ org: string; ok: boolean; error?: string }> = [];

  for (const org of orgs ?? []) {
    try {
      const orgId = org.organization_id as string;
      const botToken = org.telegram_crm_bot_token as string;
      const chatId = org.telegram_crm_chat_id as string;

      const { data: metrics, error: mErr } = await supabase.rpc('compute_honest_metrics_for_org', { p_org: orgId, p_owner: null, p_year: null });
      if (mErr || !metrics) {
        sent.push({ org: orgId, ok: false, error: mErr?.message || 'no metrics' });
        continue;
      }
      const m = metrics as {
        chq: { today: number; week: number; month: number };
        meetings_visits_week: number;
        open_proposals: { count: number; total_value_eur: number };
        weighted_pipeline_eur: number;
        goal: { year: number; annual_target_eur: number; ytd_target_eur: number; ytd_realized_eur: number; pct: number | null; semaphore: string };
      };

      // PONTO 1 — "deals frios" pela verdade única (RPC deal_state_signals): só os
      // que estão 'parado'/'arrefecer' por falta de TOQUE HUMANO há >= coldDealsDays.
      // Contactos por trabalhar e adiados NÃO contam (antes vinha de last_stage_change/updated_at).
      const { data: stSignals } = await supabase.rpc('deal_state_signals', { p_org: orgId });
      const coldCount = ((stSignals ?? []) as Array<{ status: string; days_idle: number }>).filter(
        (s) => (s.status === 'parado' || s.status === 'arrefecer') && s.days_idle >= coldDealsDays,
      ).length;

      // TAREFAS — o que o João tem de fazer hoje (activities por fazer).
      // Conta atrasadas (data anterior a hoje) e as de hoje, na data de Lisboa.
      const lisbonDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Lisbon',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);
      const { data: pendingTasks } = await supabase
        .from('activities')
        .select('date')
        .eq('organization_id', orgId)
        .eq('completed', false)
        .is('deleted_at', null);
      let tarefasHoje = 0;
      let tarefasAtrasadas = 0;
      for (const t of pendingTasks ?? []) {
        const d = String(t.date ?? '').slice(0, 10);
        if (!d) continue;
        if (d === lisbonDate) tarefasHoje += 1;
        else if (d < lisbonDate) tarefasAtrasadas += 1;
      }

      const semIcon = m.goal.semaphore === 'green' ? '🟢' : m.goal.semaphore === 'amber' ? '🟡' : m.goal.semaphore === 'red' ? '🔴' : '⚪️';
      const pctStr = m.goal.pct !== null && Number.isFinite(m.goal.pct) ? `${m.goal.pct.toFixed(1)}%` : '—';

      const lines = [
        `☀️ <b>Bom dia, João.</b>`,
        ``,
        `📊 <b>Ontem/hoje</b>`,
        `CHQ hoje: ${m.chq.today} · Semana: ${m.chq.week}`,
        `Reuniões+Visitas semana: ${m.meetings_visits_week}`,
        ``,
        `📝 Propostas abertas: <b>${m.open_proposals.count}</b> (${fmt(m.open_proposals.total_value_eur)} €)`,
        `💰 Receita ponderada: <b>${fmt(m.weighted_pipeline_eur)} €</b>`,
        ``,
        `${semIcon} <b>Meta ${m.goal.year}:</b> ${fmt(m.goal.ytd_realized_eur)} / ${fmt(m.goal.ytd_target_eur)} € YTD · ${pctStr}`,
      ];
      if (tarefasHoje + tarefasAtrasadas > 0) {
        lines.push('');
        const atrasoStr = tarefasAtrasadas > 0 ? ` · <b>${tarefasAtrasadas} atrasada${tarefasAtrasadas === 1 ? '' : 's'}</b>` : '';
        lines.push(`🗓️ <b>Tarefas:</b> ${tarefasHoje} para hoje${atrasoStr}`);
      }
      if ((coldCount ?? 0) > 0) {
        lines.push('');
        lines.push(`🥶 <b>${coldCount} ${coldCount === 1 ? 'deal frio' : 'deals frios'}</b> > ${coldDealsDays} dias sem mexer. Liga, escreve, ou aceita perda.`);
      }
      lines.push('');
      lines.push(`Atalhos: /numeros · /chq · /menu`);

      // SINO — deixa o alerta das tarefas no CRM (system_notifications), para o
      // João ver ao abrir mesmo que não leia o Telegram. Um por dia por org.
      if (tarefasHoje + tarefasAtrasadas > 0) {
        try {
          const atrasoMsg = tarefasAtrasadas > 0 ? ` e ${tarefasAtrasadas} atrasada${tarefasAtrasadas === 1 ? '' : 's'}` : '';
          const payload = {
            organization_id: orgId,
            type: 'TASKS_DUE',
            title: 'Tarefas de hoje',
            message: `Tens ${tarefasHoje} tarefa${tarefasHoje === 1 ? '' : 's'} para hoje${atrasoMsg}.`,
            link: '/dashboard',
            severity: tarefasAtrasadas > 0 ? 'high' : 'medium',
          };
          const { data: jaExiste } = await supabase
            .from('system_notifications')
            .select('id')
            .eq('organization_id', orgId)
            .eq('type', 'TASKS_DUE')
            .gte('created_at', `${lisbonDate}T00:00:00Z`)
            .limit(1);
          if (jaExiste && jaExiste.length > 0) {
            // "Disparar agora" no mesmo dia: actualiza em vez de duplicar.
            await supabase
              .from('system_notifications')
              .update({ message: payload.message, severity: payload.severity, read_at: null })
              .eq('id', (jaExiste[0] as { id: string }).id);
          } else {
            await supabase.from('system_notifications').insert(payload);
          }
        } catch {
          /* best-effort: o sino nunca pode partir o briefing */
        }
      }

      const tgRes = await fetch(`${TELEGRAM_API}/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: lines.join('\n'), parse_mode: 'HTML' }),
      });

      sent.push({ org: orgId, ok: tgRes.ok, error: tgRes.ok ? undefined : `tg ${tgRes.status}` });
    } catch (e) {
      sent.push({ org: org.organization_id as string, ok: false, error: (e as Error).message });
    }
  }

  const runOk = sent.every((s) => s.ok);
  await recordAutomationRun(supabase, 'telegram-morning-brief', runOk, sent.find((s) => !s.ok)?.error ?? null);
  return new Response(JSON.stringify({ ok: true, sent }), { status: 200, headers: { 'content-type': 'application/json' } });
});
