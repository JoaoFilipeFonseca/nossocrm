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
import { fetchPagePosts, summarizeOrganic, fetchInstagramAccountId, fetchInstagramMedia } from '@/lib/integrations/meta/organic';

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
      // Alcance (Fatia 2) DESLIGADO: a soma do alcance diário sobre-conta (mesma
      // pessoa contada vários dias) e os valores do IG vêm incoerentes — não é
      // honesto mostrá-lo como "pessoas alcançadas". Caminho certo no TODO
      // (metric_type=total_value, ≤30d, validado contra a app da Meta).
      return metaJson({ summary });
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
