// GET /api/meta-ads/statuses — estado vivo (activo/pausa) + orçamento de TODOS
// os anúncios da conta, numa só chamada à Graph API. Serve para o /anuncios
// mostrar de relance quais estão ligados, sem abrir o modal a cada um.
// Admin + org-scoped. Nunca 5xx em erro lógico.
export const dynamic = 'force-dynamic';

import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';
import { META_GRAPH_BASE } from '@/lib/integrations/meta/config';

interface AdStatus {
  status: string;
  effective_status: string;
  /** Orçamento editável (cêntimos) quando vive no adset; null se CBO/none. */
  budget_cents: number | null;
  budget_kind: 'daily' | 'lifetime' | null;
  budget_level: 'adset' | 'campaign' | 'none';
}

function cents(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? parseInt(v, 10) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function GET() {
  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;
  if (!c.adAccountId) return metaJson({ ok: true, statuses: {} });

  const map: Record<string, AdStatus> = {};
  try {
    let url: string | null =
      `${META_GRAPH_BASE}/${c.adAccountId}/ads` +
      `?fields=id,status,effective_status,adset{daily_budget,lifetime_budget,campaign{daily_budget,lifetime_budget}}` +
      `&limit=200&access_token=${encodeURIComponent(c.token)}`;

    // Pagina até ao fim (contas grandes); trava defensiva de 20 páginas.
    for (let page = 0; url && page < 20; page++) {
      const res = await fetch(url, { headers: { 'User-Agent': 'FocoImoCRM/1.0' } });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        const err = json?.error as { message?: string } | undefined;
        throw new Error(err?.message || `Erro da Graph API (HTTP ${res.status}).`);
      }
      const data = (json.data ?? []) as Array<Record<string, unknown>>;
      for (const ad of data) {
        const adset = (ad.adset ?? {}) as Record<string, unknown>;
        const campaign = (adset.campaign ?? {}) as Record<string, unknown>;
        const adDaily = cents(adset.daily_budget);
        const adLife = cents(adset.lifetime_budget);
        const cmpDaily = cents(campaign.daily_budget);
        const cmpLife = cents(campaign.lifetime_budget);
        let level: AdStatus['budget_level'] = 'none';
        let bCents: number | null = null;
        let bKind: AdStatus['budget_kind'] = null;
        if (adDaily || adLife) {
          level = 'adset';
          bCents = adDaily ?? adLife;
          bKind = adDaily ? 'daily' : 'lifetime';
        } else if (cmpDaily || cmpLife) {
          level = 'campaign';
        }
        map[String(ad.id)] = {
          status: (ad.status as string) ?? 'UNKNOWN',
          effective_status: (ad.effective_status as string) ?? 'UNKNOWN',
          budget_cents: bCents,
          budget_kind: bKind,
          budget_level: level,
        };
      }
      const paging = (json.paging ?? {}) as { next?: string };
      url = paging.next ?? null;
    }
  } catch (e) {
    return metaJson({ error: e instanceof Error ? e.message : 'Erro desconhecido.' }, 200);
  }

  return metaJson({ ok: true, statuses: map });
}
