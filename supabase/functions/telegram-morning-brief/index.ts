// Sprint 22 c1: briefing matinal automático Telegram (seg-sex).
// Para cada org com telegram_crm_bot_token + telegram_crm_chat_id, envia
// resumo do dia: CHQ semana, propostas abertas, gap meta, deals frios.
//
// Auth: X-Cron-Secret == backup_cron_secret (reusado para não multiplicar).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const TELEGRAM_API = 'https://api.telegram.org';

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

  const now = new Date();
  const lisbonStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', weekday: 'short' }).format(now);
  const dayLower = lisbonStr.toLowerCase();
  if (dayLower.startsWith('sat') || dayLower.startsWith('sun')) {
    return new Response(JSON.stringify({ ok: true, skipped: 'weekend' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }

  const { data: orgs, error: orgsErr } = await supabase
    .from('organization_settings')
    .select('organization_id, telegram_crm_bot_token, telegram_crm_chat_id')
    .not('telegram_crm_bot_token', 'is', null)
    .not('telegram_crm_chat_id', 'is', null);

  if (orgsErr) {
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

      const cutoff = new Date(Date.now() - 10 * 86400000).toISOString();
      const { count: coldCount } = await supabase
        .from('deals')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', orgId)
        .is('deleted_at', null)
        .eq('is_won', false)
        .eq('is_lost', false)
        .or(`last_stage_change_date.lt.${cutoff},and(last_stage_change_date.is.null,updated_at.lt.${cutoff})`);

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
      if ((coldCount ?? 0) > 0) {
        lines.push('');
        lines.push(`🥶 <b>${coldCount} ${coldCount === 1 ? 'deal frio' : 'deals frios'}</b> > 10 dias sem mexer. Liga, escreve, ou aceita perda.`);
      }
      lines.push('');
      lines.push(`Atalhos: /numeros · /chq · /menu`);

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

  return new Response(JSON.stringify({ ok: true, sent }), { status: 200, headers: { 'content-type': 'application/json' } });
});
