/**
 * POST /api/power-list/run — BRIEF 2. Envia a Power List da manhã.
 *
 * Modos:
 *   - CRON: header X-Cron-Secret == backup_cron_secret → percorre todas as orgs
 *     com canal Resend + Telegram configurados. (2ª a 6ª; guarda de fim-de-semana.)
 *   - (o mesmo caminho serve o "Correr agora" da UI /automacoes, que também envia
 *     X-Cron-Secret via trigger_system_automation_now.)
 *
 * Para cada org: monta a lista (RPC power_list), gera a primeira frase (IA),
 * envia email (Resend, marca do João, UTF-8) + resumo Telegram, e regista a
 * corrida em system_automations. Nunca devolve 5xx em erro lógico.
 */
import { NextRequest } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { sendTelegramMessage } from '@/lib/notifications/telegram';
import { assembleItems, buildNumeroDoDia, chqWeekFromMetrics, type RawPowerListRow } from '@/lib/power-list/build';
import { renderPowerListEmail } from '@/lib/power-list/email';
import { buildTelegramSummary } from '@/lib/power-list/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const APP_URL = 'https://crm.joaofilipefonseca.pt';
type Admin = ReturnType<typeof createStaticAdminClient>;

interface ResendCreds {
  apiKey?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
}

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

function isWeekendLisbon(): boolean {
  const wd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', weekday: 'short' })
    .format(new Date())
    .toLowerCase();
  return wd.startsWith('sat') || wd.startsWith('sun');
}

async function sendResendEmail(
  creds: ResendCreds,
  to: string,
  subject: string,
  html: string,
  text: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!creds.apiKey || !creds.fromEmail) return { ok: false, error: 'Credenciais Resend incompletas' };
  const from = creds.fromName ? `${creds.fromName} <${creds.fromEmail}>` : creds.fromEmail;
  const body: Record<string, unknown> = { from, to: [to], subject, html, text };
  if (creds.replyTo) body.reply_to = creds.replyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.apiKey}` },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; error?: { message?: string } };
  if (!res.ok || data.error) {
    return { ok: false, error: data.error?.message || data.message || `Resend ${res.status}` };
  }
  return { ok: true };
}

async function recordRun(admin: Admin, ok: boolean, error: string | null): Promise<void> {
  try {
    const { data: cur } = await admin
      .from('system_automations')
      .select('run_count, fail_count')
      .eq('key', 'power-list')
      .maybeSingle();
    await admin
      .from('system_automations')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_ok: ok,
        last_run_error: error,
        run_count: ((cur as { run_count?: number } | null)?.run_count ?? 0) + 1,
        fail_count: ((cur as { fail_count?: number } | null)?.fail_count ?? 0) + (ok ? 0 : 1),
      })
      .eq('key', 'power-list');
  } catch {
    /* best-effort */
  }
}

async function runForOrg(
  admin: Admin,
  orgId: string,
  listSize: number,
  weeklyGoal: number,
): Promise<{ org: string; sent: number; ok: boolean; error?: string; email?: boolean; telegram?: boolean }> {
  // 1) Lista priorizada.
  const { data: rowsData, error: rowsErr } = await admin.rpc('power_list', { p_org: orgId, p_n: listSize });
  if (rowsErr) return { org: orgId, sent: 0, ok: false, error: `power_list: ${rowsErr.message}` };
  const rows = (rowsData ?? []) as RawPowerListRow[];
  if (rows.length === 0) return { org: orgId, sent: 0, ok: true };

  // 2) Número do dia.
  const { data: metrics } = await admin.rpc('compute_honest_metrics_for_org', {
    p_org: orgId,
    p_owner: null,
    p_year: null,
  });
  const numeroDoDia = buildNumeroDoDia(chqWeekFromMetrics(metrics), weeklyGoal);

  // 3) Frases da IA + montagem.
  const items = await assembleItems(admin, orgId, rows);

  // 4) Canal Resend + destinatário (admin da org).
  const { data: channel } = await admin
    .from('messaging_channels')
    .select('credentials')
    .eq('organization_id', orgId)
    .eq('provider', 'resend')
    .eq('channel_type', 'email')
    .eq('status', 'connected')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: adminProfile } = await admin
    .from('profiles')
    .select('email')
    .eq('organization_id', orgId)
    .eq('role', 'admin')
    .not('email', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  const recipient = (adminProfile as { email?: string } | null)?.email || null;
  const creds = ((channel as { credentials?: ResendCreds } | null)?.credentials || {}) as ResendCreds;

  let emailOk = false;
  let emailErr: string | undefined;
  if (recipient && creds.apiKey && creds.fromEmail) {
    const { subject, html, text } = renderPowerListEmail({ items, numeroDoDia, appUrl: APP_URL });
    const r = await sendResendEmail(creds, recipient, subject, html, text);
    emailOk = r.ok;
    emailErr = r.error;
  } else {
    emailErr = !recipient ? 'sem email do admin' : 'sem canal Resend';
  }

  // 5) Telegram (best-effort).
  let telegramOk = false;
  let telegramErr: string | undefined;
  const { data: settings } = await admin
    .from('organization_settings')
    .select('telegram_crm_bot_token, telegram_crm_chat_id')
    .eq('organization_id', orgId)
    .maybeSingle();
  const botToken = (settings as { telegram_crm_bot_token?: string } | null)?.telegram_crm_bot_token;
  const chatId = (settings as { telegram_crm_chat_id?: string } | null)?.telegram_crm_chat_id;
  if (botToken && chatId) {
    try {
      await sendTelegramMessage(botToken, chatId, buildTelegramSummary(items, numeroDoDia, APP_URL));
      telegramOk = true;
    } catch (e) {
      telegramErr = (e as Error).message;
    }
  }

  const ok = emailOk || telegramOk; // ao menos um canal entregou
  const error = [emailErr && `email: ${emailErr}`, telegramErr && `tg: ${telegramErr}`].filter(Boolean).join(' | ') || undefined;
  return { org: orgId, sent: items.length, ok, error, email: emailOk, telegram: telegramOk };
}

export async function POST(req: NextRequest) {
  const admin = createStaticAdminClient();
  const cronSecret = req.headers.get('X-Cron-Secret') ?? '';

  // Só o caminho de cron/secret (que também serve o "Correr agora" da UI).
  const { data: expected } = await admin.rpc('get_backup_cron_secret');
  if (!expected || cronSecret !== expected) {
    return json({ error: 'forbidden' }, 403);
  }

  let body: { manual_trigger?: boolean } = {};
  try {
    body = (await req.json()) as { manual_trigger?: boolean };
  } catch {
    /* corpo vazio */
  }

  // Guarda de fim-de-semana (o cron já é 2ª-6ª; isto protege o "Correr agora").
  if (!body.manual_trigger && isWeekendLisbon()) {
    return json({ ok: true, skipped: 'weekend' });
  }

  // Estado da automação em /automacoes.
  const { data: automation } = await admin
    .from('system_automations')
    .select('enabled, params')
    .eq('key', 'power-list')
    .maybeSingle();
  if (!body.manual_trigger && automation && automation.enabled === false) {
    return json({ ok: true, skipped: 'disabled' });
  }
  const params = (automation?.params ?? {}) as { list_size?: number; weekly_goal?: number };
  const listSize = Math.max(1, Math.floor(Number(params.list_size) || 15));
  const weeklyGoal = Math.max(1, Math.floor(Number(params.weekly_goal) || 25));

  // Orgs com canal Resend connected.
  const { data: channels } = await admin
    .from('messaging_channels')
    .select('organization_id')
    .eq('provider', 'resend')
    .eq('channel_type', 'email')
    .eq('status', 'connected')
    .is('deleted_at', null);
  const orgIds = Array.from(
    new Set(((channels ?? []) as Array<{ organization_id: string }>).map((c) => c.organization_id)),
  );

  const results: Array<Awaited<ReturnType<typeof runForOrg>>> = [];
  for (const orgId of orgIds) {
    try {
      results.push(await runForOrg(admin, orgId, listSize, weeklyGoal));
    } catch (e) {
      results.push({ org: orgId, sent: 0, ok: false, error: (e as Error).message });
    }
  }

  const runOk = results.length === 0 ? true : results.every((r) => r.ok);
  await recordRun(admin, runOk, results.find((r) => !r.ok)?.error ?? null);
  return json({ ok: true, results });
}
