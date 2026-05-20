import { createStaticAdminClient } from '@/lib/supabase/server';
import { computeMatches } from '@/lib/matches/engine';

export const maxDuration = 60;

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/**
 * GET /api/cron/matches
 *
 * Cron diario (Vercel) 06:05 Lisboa = 05:05 UTC.
 * Re-corre o engine para cada organizacao com raw_intel intent=procura
 * activa nos ultimos 90 dias. Decay aplica-se automaticamente no scoring.
 *
 * Protegido por Bearer CRON_SECRET (mesmo padrao de daily-briefing).
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('Authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  const supabase = createStaticAdminClient();
  const cutoff = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();

  // Orgs com raw_intel procura activo nos ultimos 90 dias
  const { data: orgsRows, error: orgsErr } = await supabase
    .from('raw_intel')
    .select('organization_id')
    .eq('intent', 'procura')
    .neq('status', 'arquivado')
    .gte('created_at', cutoff);

  if (orgsErr) return json({ ok: false, error: orgsErr.message }, 500);

  const orgIds = Array.from(new Set((orgsRows ?? []).map((r) => r.organization_id as string).filter(Boolean)));

  const results: { organization_id: string; inserted?: number; error?: string }[] = [];
  for (const orgId of orgIds) {
    try {
      const r = await computeMatches(orgId);
      results.push({ organization_id: orgId, inserted: r.inserted });
    } catch (err) {
      results.push({ organization_id: orgId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  const totalInserted = results.reduce((s, r) => s + (r.inserted ?? 0), 0);
  return json({
    ok: true,
    orgs: orgIds.length,
    totalInserted,
    results,
    ranAt: new Date().toISOString(),
  });
}
