/**
 * POST /api/radar-maia/run — BRIEF 6. Radar Maia (08:30).
 *
 * CRON: header X-Cron-Secret == backup_cron_secret → recolhe novas entradas do
 * mercado da Maia (Apify), grava em market_listings, cria FSBO no CRM e envia o
 * resumo das 08:30 (email + Telegram). Também serve o "Correr agora" da UI.
 *
 * Corpo (opcional, para teste/afinação):
 *   { manual_trigger?: true, skip_scrape?: true, no_send?: true,
 *     items?: [{ portal: 'idealista'|'olx', records: [...brutos do portal...] }] }
 *
 * Nunca devolve 5xx em erro lógico.
 */
import { NextRequest } from 'next/server';
import { createStaticAdminClient } from '@/lib/supabase/staticAdminClient';
import { runRadar, type RadarReport } from '@/lib/radar/run';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

type Admin = ReturnType<typeof createStaticAdminClient>;

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
}

function isSundayLisbon(): boolean {
  const wd = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Lisbon', weekday: 'short' }).format(new Date()).toLowerCase();
  return wd.startsWith('sun');
}

async function recordRun(admin: Admin, ok: boolean, error: string | null): Promise<void> {
  try {
    const { data: cur } = await admin.from('system_automations').select('run_count, fail_count').eq('key', 'radar-maia').maybeSingle();
    await admin
      .from('system_automations')
      .update({
        last_run_at: new Date().toISOString(),
        last_run_ok: ok,
        last_run_error: error,
        run_count: ((cur as { run_count?: number } | null)?.run_count ?? 0) + 1,
        fail_count: ((cur as { fail_count?: number } | null)?.fail_count ?? 0) + (ok ? 0 : 1),
      })
      .eq('key', 'radar-maia');
  } catch {
    /* best-effort */
  }
}

interface Body {
  manual_trigger?: boolean;
  skip_scrape?: boolean;
  no_send?: boolean;
  items?: Array<{ portal: string; records: unknown[] }>;
}

export async function POST(req: NextRequest) {
  const admin = createStaticAdminClient();
  const cronSecret = req.headers.get('X-Cron-Secret') ?? '';

  const { data: expected } = await admin.rpc('get_backup_cron_secret');
  if (!expected || cronSecret !== expected) return json({ error: 'forbidden' }, 403);

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    /* corpo vazio */
  }

  // Nunca ao Domingo (o cron é 2ª-6ª e sábado; isto protege o "Correr agora").
  if (!body.manual_trigger && isSundayLisbon()) return json({ ok: true, skipped: 'sunday' });

  const { data: automation } = await admin.from('system_automations').select('enabled, params').eq('key', 'radar-maia').maybeSingle();
  if (!body.manual_trigger && automation && automation.enabled === false) return json({ ok: true, skipped: 'disabled' });

  const params = (automation?.params ?? {}) as { portais?: string[]; max_por_portal?: number; janela_horas?: number };
  const portals = Array.isArray(params.portais) && params.portais.length ? params.portais : ['idealista', 'olx'];
  const maxPerPortal = Math.max(10, Math.floor(Number(params.max_por_portal) || 150));
  const janelaHoras = Math.max(1, Math.floor(Number(params.janela_horas) || 48));

  // Orgs com canal Resend connected (mesma base da Power List).
  const { data: channels } = await admin
    .from('messaging_channels')
    .select('organization_id')
    .eq('provider', 'resend')
    .eq('channel_type', 'email')
    .eq('status', 'connected')
    .is('deleted_at', null);
  const orgIds = Array.from(new Set(((channels ?? []) as Array<{ organization_id: string }>).map((c) => c.organization_id)));

  const results: RadarReport[] = [];
  for (const orgId of orgIds) {
    // Token da Apify (chave do João) por org.
    const { data: settings } = await admin.from('organization_settings').select('apify_token').eq('organization_id', orgId).maybeSingle();
    const apifyToken = (settings as { apify_token?: string } | null)?.apify_token || null;
    try {
      const report = await runRadar(
        admin,
        orgId,
        {
          portals,
          maxPerPortal,
          janelaHoras,
          skipScrape: body.skip_scrape,
          providedItems: body.items,
          send: !body.no_send,
        },
        apifyToken,
      );
      results.push(report);
    } catch (e) {
      results.push({ org: orgId, ok: false, error: (e as Error).message, scraped: {}, seen: 0, inserted: 0, updated: 0, fsbo: [], priceDrops: 0, tired: 0 });
    }
  }

  const runOk = results.length === 0 ? true : results.every((r) => r.ok);
  await recordRun(admin, runOk, results.find((r) => !r.ok)?.error ?? null);
  // fsbo pode ser grande; devolve só a contagem no sumário da corrida.
  const slim = results.map((r) => ({ ...r, fsbo: r.fsbo.length, fsboSample: r.fsbo.slice(0, 5) }));
  return json({ ok: true, results: slim });
}
