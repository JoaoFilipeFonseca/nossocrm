/**
 * Brief 6 — Radar Maia. Orquestrador: recolhe → normaliza → ingere → FSBO → digest.
 * Reutilizado pela rota /api/radar-maia/run (cron e "Correr agora").
 */
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { sendTelegramMessage } from '@/lib/notifications/telegram';
import { PORTALS, collectPortal } from './apify';
import { normalizeByPortal, isMaia } from './normalize';
import { ingestListings } from './ingest';
import { createFsboFromListings, type CreatedFsbo } from './fsbo';
import { collectDigestData, renderDigestEmail, renderDigestTelegram } from './digest';
import type { CanonListing } from './types';

type Admin = ReturnType<typeof createStaticAdminClient>;

interface ResendCreds {
  apiKey?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
}

export interface RadarOptions {
  portals: string[];
  maxPerPortal: number;
  janelaHoras: number;
  skipScrape?: boolean;
  providedItems?: Array<{ portal: string; records: unknown[] }>;
  send?: boolean; // envia email/telegram (default true)
}

export interface RadarReport {
  org: string;
  ok: boolean;
  error?: string;
  scraped: Record<string, number>;
  seen: number;
  inserted: number;
  updated: number;
  fsbo: CreatedFsbo[];
  priceDrops: number;
  tired: number;
  email?: boolean;
  telegram?: boolean;
}

async function sendResendEmail(creds: ResendCreds, to: string, subject: string, html: string, text: string): Promise<{ ok: boolean; error?: string }> {
  if (!creds.apiKey || !creds.fromEmail) return { ok: false, error: 'Credenciais Resend incompletas' };
  const from = creds.fromName ? `${creds.fromName} <${creds.fromEmail}>` : creds.fromEmail;
  const body: Record<string, unknown> = { from, to: [to], subject, html, text };
  if (creds.replyTo) body.reply_to = creds.replyTo;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${creds.apiKey}`, 'User-Agent': 'foco-imo-radar/1.0' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { message?: string; error?: { message?: string } };
  if (!res.ok || data.error) return { ok: false, error: data.error?.message || data.message || `Resend ${res.status}` };
  return { ok: true };
}

/** Recolhe os anúncios brutos de cada portal (Apify) ou usa os fornecidos (teste). */
async function gatherRaw(opts: RadarOptions, apifyToken: string | null): Promise<Array<{ portal: string; records: unknown[] }>> {
  if (opts.providedItems && opts.providedItems.length) return opts.providedItems;
  if (opts.skipScrape || !apifyToken) return [];
  const out: Array<{ portal: string; records: unknown[] }> = [];
  await Promise.all(
    opts.portals.map(async (p) => {
      const cfg = PORTALS[p];
      if (!cfg) return;
      try {
        const records = await collectPortal(apifyToken, cfg, { maxItems: opts.maxPerPortal, janelaHoras: opts.janelaHoras });
        out.push({ portal: p, records });
      } catch {
        out.push({ portal: p, records: [] });
      }
    }),
  );
  return out;
}

export async function runRadar(admin: Admin, orgId: string, opts: RadarOptions, apifyToken: string | null): Promise<RadarReport> {
  const scraped: Record<string, number> = {};
  const canon: CanonListing[] = [];

  const raw = await gatherRaw(opts, apifyToken);
  for (const { portal, records } of raw) {
    scraped[portal] = records.length;
    for (const r of records) {
      const c = normalizeByPortal(portal, r);
      if (!c) continue;
      if (c.operation !== 'venda') continue;
      // Guarda geográfica: Idealista já vem filtrado por Maia; OLX pode trazer vizinhos.
      if (portal === 'olx' && !isMaia(c)) continue;
      canon.push(c);
    }
  }

  const summary = await ingestListings(admin, orgId, canon);
  const fsbo = await createFsboFromListings(admin, orgId, summary.newListings);
  const digest = await collectDigestData(admin, orgId, summary, fsbo);

  let email: boolean | undefined;
  let telegram: boolean | undefined;
  const send = opts.send !== false;
  if (send) {
    // Email (Resend, marca João) para o admin da org.
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
    if (recipient && creds.apiKey && creds.fromEmail) {
      const { subject, html, text } = renderDigestEmail(digest);
      const r = await sendResendEmail(creds, recipient, subject, html, text);
      email = r.ok;
    } else {
      email = false;
    }

    // Telegram.
    const { data: settings } = await admin
      .from('organization_settings')
      .select('telegram_crm_bot_token, telegram_crm_chat_id')
      .eq('organization_id', orgId)
      .maybeSingle();
    const botToken = (settings as { telegram_crm_bot_token?: string } | null)?.telegram_crm_bot_token;
    const chatId = (settings as { telegram_crm_chat_id?: string } | null)?.telegram_crm_chat_id;
    if (botToken && chatId) {
      try {
        await sendTelegramMessage(botToken, chatId, renderDigestTelegram(digest));
        telegram = true;
      } catch {
        telegram = false;
      }
    }
  }

  return {
    org: orgId,
    ok: true,
    scraped,
    seen: summary.seen,
    inserted: summary.inserted,
    updated: summary.updated,
    fsbo,
    priceDrops: digest.drops.length,
    tired: digest.tired.length,
    email,
    telegram,
  };
}
