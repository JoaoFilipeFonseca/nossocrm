// GET /api/organico — Orgânico da Página (MKT-ORGANIC-INSIGHTS).
// Lê os posts da Página ao vivo (Graph API) e devolve o resumo agregado.
// Reusa o token do Vault → token da Página. Admin + org. Nunca 5xx em erro lógico.
// Facebook Page + Instagram (posts/interacções, ORG-IG Fatia 1, instagram_basic).
// Alcance/impressões (read_insights / instagram_manage_insights) = Fatia 2 (re-autorização).
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest } from 'next/server';
import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';
import { getPageAccessToken } from '@/lib/integrations/meta/leadforms';
import { fetchPagePosts, summarizeOrganic, fetchInstagramAccountId, fetchInstagramMedia, fetchInstagramReach } from '@/lib/integrations/meta/organic';

export async function GET(req: NextRequest) {
  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;
  if (!c.pageId) return metaJson({ error: 'Página não seleccionada na integração Meta.' }, 200);

  const { searchParams } = new URL(req.url);
  const fromRaw = searchParams.get('from');
  const toRaw = searchParams.get('to');
  const since = fromRaw ? `${fromRaw}T00:00:00Z` : null;
  const until = toRaw ? `${toRaw}T23:59:59Z` : null;
  const network = searchParams.get('network') ?? 'facebook';

  if (network === 'instagram') {
    try {
      const pageToken = await getPageAccessToken(c.pageId, c.token);
      const igId = await fetchInstagramAccountId(c.pageId, pageToken);
      if (!igId) {
        return metaJson({
          error: 'instagram_not_linked',
          message: 'Para ver o orgânico do Instagram, ligue a conta Instagram Business à Página nas Definições da Página da Meta (Contas ligadas → Instagram).',
          summary: null,
        }, 200);
      }
      const media = await fetchInstagramMedia(igId, pageToken, since, until);
      const summary = summarizeOrganic(media);
      // ORG-IG Fatia 2: Alcance único do período (metric_type=total_value, ≤30d).
      // VALIDADO contra o Meta Business Suite (17/06/2026: Alcance IG = 290 nos dois)
      // → reach_available passa a true quando há número. reach_window deixa a UI
      // rotular quando a janela pedida (>30d) foi reduzida ao último mês.
      const { reach, window } = await fetchInstagramReach(igId, pageToken, since, until, new Date().toISOString());
      return metaJson({ summary: { ...summary, reach, reach_available: reach !== null }, reach_window: window });
    } catch (e) {
      return metaJson({ error: e instanceof Error ? e.message : 'Não foi possível ler o orgânico do Instagram.', summary: null }, 200);
    }
  }

  try {
    const pageToken = await getPageAccessToken(c.pageId, c.token);
    const posts = await fetchPagePosts(c.pageId, pageToken, since, until);
    const summary = summarizeOrganic(posts);
    // Alcance (Fatia 2) desligado — ver nota no ramo do Instagram. TODO: total_value.
    return metaJson({ summary });
  } catch (e) {
    return metaJson({ error: e instanceof Error ? e.message : 'Não foi possível ler o orgânico da Página.' }, 200);
  }
}
