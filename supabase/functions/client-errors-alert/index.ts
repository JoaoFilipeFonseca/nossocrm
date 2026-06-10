// Sprint 25 c1: alerta Telegram em rajada de erros front-end.
// Cron 5min. Se org tem >= 3 erros não-alertados em < 5 min, dispara
// mensagem para o telegram_crm_chat_id da org e marca rows como alerted.
//
// Auth: X-Cron-Secret == backup_cron_secret (reusado).

import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import { loadAutomationParams } from '../_shared/automation-params.ts';
import { recordAutomationRun } from '../_shared/record-run.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TELEGRAM_API = 'https://api.telegram.org';
const DEFAULTS = { threshold: 3, window_minutes: 5 };

Deno.serve(async (req: Request) => {
  const cronSecret = req.headers.get('X-Cron-Secret') || '';
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: expectedSecret } = await supabase.rpc('get_backup_cron_secret');
  if (!expectedSecret || cronSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: { 'content-type': 'application/json' } });
  }

  const params = await loadAutomationParams(supabase, 'client-errors-alert', DEFAULTS);
  const threshold = Math.max(1, Math.floor(Number(params.threshold) || DEFAULTS.threshold));
  const windowMinutes = Math.max(1, Math.floor(Number(params.window_minutes) || DEFAULTS.window_minutes));
  const windowMs = windowMinutes * 60 * 1000;

  const cutoff = new Date(Date.now() - windowMs).toISOString();

  const { data: pending, error: qErr } = await supabase
    .from('client_errors')
    .select('id, organization_id, source, message, created_at')
    .is('alerted_at', null)
    .gte('created_at', cutoff)
    .not('organization_id', 'is', null)
    .order('created_at', { ascending: false });

  if (qErr) {
    await recordAutomationRun(supabase, 'client-errors-alert', false, qErr.message);
    return new Response(JSON.stringify({ error: qErr.message }), { status: 500, headers: { 'content-type': 'application/json' } });
  }

  const byOrg = new Map<string, typeof pending>();
  for (const row of pending ?? []) {
    const arr = byOrg.get(row.organization_id) || [];
    arr.push(row);
    byOrg.set(row.organization_id, arr);
  }

  const sent: Array<{ org: string; count: number; ok: boolean; error?: string }> = [];

  for (const [orgId, rows] of byOrg.entries()) {
    if (rows.length < threshold) {
      sent.push({ org: orgId, count: rows.length, ok: false, error: 'below threshold' });
      continue;
    }

    const { data: org } = await supabase
      .from('organization_settings')
      .select('telegram_crm_bot_token, telegram_crm_chat_id')
      .eq('organization_id', orgId)
      .single();

    if (!org?.telegram_crm_bot_token || !org?.telegram_crm_chat_id) {
      sent.push({ org: orgId, count: rows.length, ok: false, error: 'no telegram configured' });
      continue;
    }

    const sample = rows.slice(0, 3).map((r) => `• <code>${r.source}</code>: ${(r.message || '').slice(0, 80)}`).join('\n');
    const text = [
      `⚠️ <b>Rajada de erros front-end</b>`,
      `${rows.length} erros nos últimos ${windowMinutes} minutos.`,
      ``,
      sample,
      ``,
      `Investigar em /admin/saude`,
    ].join('\n');

    const tgRes = await fetch(`${TELEGRAM_API}/bot${org.telegram_crm_bot_token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: org.telegram_crm_chat_id,
        text,
        parse_mode: 'HTML',
      }),
    });

    if (tgRes.ok) {
      const ids = rows.map((r) => r.id);
      await supabase.from('client_errors').update({ alerted_at: new Date().toISOString() }).in('id', ids);
      sent.push({ org: orgId, count: rows.length, ok: true });
    } else {
      sent.push({ org: orgId, count: rows.length, ok: false, error: `tg ${tgRes.status}` });
    }
  }

  // A corrida em si correu bem; entradas "below threshold"/"no telegram" são
  // estado normal (nada a alertar), não falhas. Falha de envio real marca fail.
  const runErr = sent.find((s) => s.error && s.error.startsWith('tg '))?.error ?? null;
  await recordAutomationRun(supabase, 'client-errors-alert', runErr === null, runErr);
  return new Response(JSON.stringify({ ok: true, sent }), { status: 200, headers: { 'content-type': 'application/json' } });
});
