/**
 * POST /api/nurture/send — BRIEF 7. Envia os emails de nurture APROVADOS.
 *
 * Dois caminhos:
 *   - CRON/despachante: header X-Cron-Secret == backup_cron_secret → percorre as
 *     orgs com emails aprovados (idempotente; só approved → sent).
 *   - UI ("Enviar aprovados"): sessão de admin → a própria org.
 *
 * Regras: NUNCA ao Domingo; nunca para opt-out nem para dados de teste
 * (attribution.is_test); rodapé RGPD (anular subscrição + política) + cabeçalho
 * List-Unsubscribe; regista deal_activity (actor=automation) e o contador em
 * /automacoes. Nunca devolve 5xx em erro lógico.
 */
import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import {
  appendComplianceFooter,
  buildUnsubscribeUrl,
  DEFAULT_PRIVACY_POLICY_URL,
  escapeIlike,
  unsubscribeToken,
} from '@/lib/messaging/emailCompliance';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

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

function isSundayLisbon(): boolean {
  const wd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', weekday: 'short' })
    .format(new Date())
    .toLowerCase();
  return wd.startsWith('sun');
}

async function recordRun(admin: Admin, ok: boolean, error: string | null): Promise<void> {
  try {
    const { data: cur } = await admin
      .from('system_automations')
      .select('run_count, fail_count')
      .eq('key', 'nurture-email')
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
      .eq('key', 'nurture-email');
  } catch {
    /* best-effort */
  }
}

interface NurtureRow {
  id: string;
  contact_id: string;
  deal_id: string | null;
  to_email: string;
  subject: string;
  body_text: string;
  body_html: string | null;
  wave: string;
  step: number;
}

async function sendForOrg(
  admin: Admin,
  orgId: string,
  limit: number,
): Promise<{ org: string; sent: number; skipped: number; failed: number; ok: boolean; error?: string }> {
  // Emails aprovados desta org.
  const { data: rowsData, error: rowsErr } = await admin
    .from('nurture_emails')
    .select('id, contact_id, deal_id, to_email, subject, body_text, body_html, wave, step')
    .eq('organization_id', orgId)
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(limit);
  if (rowsErr) return { org: orgId, sent: 0, skipped: 0, failed: 0, ok: false, error: rowsErr.message };
  const rows = (rowsData ?? []) as NurtureRow[];
  if (rows.length === 0) return { org: orgId, sent: 0, skipped: 0, failed: 0, ok: true };

  // Canal Resend connected.
  const { data: channel } = await admin
    .from('messaging_channels')
    .select('id, credentials')
    .eq('organization_id', orgId)
    .eq('provider', 'resend')
    .eq('channel_type', 'email')
    .eq('status', 'connected')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const creds = ((channel as { credentials?: ResendCreds } | null)?.credentials || {}) as ResendCreds;
  const channelId = (channel as { id?: string } | null)?.id ?? null;
  if (!creds.apiKey || !creds.fromEmail) {
    return { org: orgId, sent: 0, skipped: 0, failed: 0, ok: false, error: 'sem canal Resend connected' };
  }
  const fromHeader = creds.fromName ? `${creds.fromName} <${creds.fromEmail}>` : creds.fromEmail;

  // Guardas por contacto: opt-out e is_test (fresco).
  const contactIds = Array.from(new Set(rows.map((r) => r.contact_id)));
  const { data: contactsData } = await admin
    .from('contacts')
    .select('id, email_opt_out, attribution')
    .in('id', contactIds);
  const optOut = new Set<string>();
  const isTest = new Set<string>();
  for (const c of (contactsData ?? []) as Array<{ id: string; email_opt_out: boolean | null; attribution: { is_test?: boolean } | null }>) {
    if (c.email_opt_out === true) optOut.add(c.id);
    if (c.attribution?.is_test === true) isTest.add(c.id);
  }

  // Secret de anular subscrição + política (uma vez).
  const { data: unsubSecret } = await admin.rpc('get_email_unsubscribe_secret');
  const { data: orgSettings } = await admin
    .from('organization_settings')
    .select('privacy_policy_url')
    .eq('organization_id', orgId)
    .maybeSingle();
  const privacyPolicyUrl =
    (orgSettings as { privacy_policy_url?: string | null } | null)?.privacy_policy_url || DEFAULT_PRIVACY_POLICY_URL;

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const row of rows) {
    // Guardas: opt-out / teste → marca skipped, não envia.
    if (optOut.has(row.contact_id) || isTest.has(row.contact_id)) {
      await admin.from('nurture_emails').update({ status: 'skipped', error: optOut.has(row.contact_id) ? 'opt_out' : 'is_test' }).eq('id', row.id);
      skipped += 1;
      continue;
    }

    // Dupla verificação de opt-out por email exacto (case-insensitive).
    const { data: optRows } = await admin
      .from('contacts')
      .select('id')
      .eq('organization_id', orgId)
      .eq('email_opt_out', true)
      .ilike('email', escapeIlike(row.to_email))
      .limit(1);
    if (optRows && optRows.length > 0) {
      await admin.from('nurture_emails').update({ status: 'skipped', error: 'opt_out' }).eq('id', row.id);
      skipped += 1;
      continue;
    }

    // Rodapé RGPD.
    let unsubscribeUrl: string | null = null;
    if (typeof unsubSecret === 'string' && unsubSecret.length > 0) {
      const token = await unsubscribeToken(orgId, row.to_email, unsubSecret);
      unsubscribeUrl = buildUnsubscribeUrl(APP_URL, orgId, row.to_email, token);
    }
    const footered = appendComplianceFooter({
      text: row.body_text,
      html: row.body_html || undefined,
      senderName: creds.fromName || creds.fromEmail!,
      unsubscribeUrl,
      privacyPolicyUrl,
    });

    const body: Record<string, unknown> = {
      from: fromHeader,
      to: [row.to_email],
      subject: row.subject,
      text: footered.text,
    };
    if (footered.html) body.html = footered.html;
    if (creds.replyTo) body.reply_to = creds.replyTo;
    if (unsubscribeUrl) body.headers = { 'List-Unsubscribe': `<${unsubscribeUrl}>` };

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.apiKey}` },
        body: JSON.stringify(body),
      });
      const dataJson = (await res.json().catch(() => ({}))) as { id?: string; message?: string; error?: { message?: string } };
      if (!res.ok || dataJson.error) {
        const err = dataJson.error?.message || dataJson.message || `Resend ${res.status}`;
        await admin.from('nurture_emails').update({ status: 'failed', error: err }).eq('id', row.id);
        failed += 1;
        continue;
      }
      await admin
        .from('nurture_emails')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
          external_message_id: dataJson.id || null,
          channel_id: channelId,
          error: null,
        })
        .eq('id', row.id);

      // Regista o toque na timeline (actor=automation).
      if (row.deal_id) {
        await admin.from('deal_activities').insert({
          organization_id: orgId,
          deal_id: row.deal_id,
          contact_id: row.contact_id,
          type: 'nurture_email',
          description: `Email de nurture enviado: "${row.subject}"`,
          actor: 'automation',
          metadata: { wave: row.wave, step: row.step, external_message_id: dataJson.id || null },
        });
      }
      sent += 1;
    } catch (e) {
      await admin.from('nurture_emails').update({ status: 'failed', error: (e as Error).message }).eq('id', row.id);
      failed += 1;
    }
  }

  return { org: orgId, sent, skipped, failed, ok: failed === 0 };
}

export async function POST(req: NextRequest) {
  const admin = createStaticAdminClient();
  const cronSecret = req.headers.get('X-Cron-Secret') ?? '';

  let mode: 'cron' | 'ui' | null = null;
  const orgIds: string[] = [];

  if (cronSecret) {
    const { data: expected } = await admin.rpc('get_backup_cron_secret');
    if (!expected || cronSecret !== expected) return json({ error: 'forbidden' }, 403);
    mode = 'cron';
  } else {
    if (!isAllowedOrigin(req)) return json({ error: 'Forbidden' }, 403);
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);
    const { data: profile } = await supabase
      .from('profiles')
      .select('organization_id, role')
      .eq('id', user.id)
      .maybeSingle();
    const orgId = (profile as { organization_id?: string } | null)?.organization_id;
    const role = (profile as { role?: string } | null)?.role;
    if (!orgId) return json({ error: 'Profile not found' }, 404);
    if (role !== 'admin') return json({ error: 'Admin only' }, 403);
    mode = 'ui';
    orgIds.push(orgId);
  }

  let body: { manual_trigger?: boolean; limit?: number } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    /* vazio */
  }
  const limit = Math.max(1, Math.min(300, Math.floor(Number(body.limit) || 200)));

  // NUNCA ao Domingo (o cron 1-6 já exclui; isto protege o disparo manual/UI).
  if (isSundayLisbon()) {
    return json({ ok: true, skipped: 'sunday' });
  }

  // Estado da automação em /automacoes (respeitar desligado no modo cron).
  const { data: automation } = await admin
    .from('system_automations')
    .select('enabled')
    .eq('key', 'nurture-email')
    .maybeSingle();
  if (mode === 'cron' && automation && automation.enabled === false) {
    return json({ ok: true, skipped: 'disabled' });
  }

  // No modo cron, todas as orgs com emails aprovados.
  if (mode === 'cron') {
    const { data: approved } = await admin
      .from('nurture_emails')
      .select('organization_id')
      .eq('status', 'approved');
    const set = new Set(((approved ?? []) as Array<{ organization_id: string }>).map((r) => r.organization_id));
    orgIds.push(...set);
  }

  const results: Array<Awaited<ReturnType<typeof sendForOrg>>> = [];
  for (const orgId of orgIds) {
    try {
      results.push(await sendForOrg(admin, orgId, limit));
    } catch (e) {
      results.push({ org: orgId, sent: 0, skipped: 0, failed: 0, ok: false, error: (e as Error).message });
    }
  }

  const totalSent = results.reduce((a, r) => a + r.sent, 0);
  const runOk = results.length === 0 ? true : results.every((r) => r.ok);
  // Só conta uma corrida com envios (evita inflar o contador com o cron diário vazio).
  if (totalSent > 0 || results.some((r) => r.failed > 0)) {
    await recordRun(admin, runOk, results.find((r) => !r.ok)?.error ?? null);
  }
  return json({ ok: true, results });
}
