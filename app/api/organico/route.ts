// GET /api/organico — Orgânico da Página (MKT-ORGANIC-INSIGHTS).
// Lê os posts da Página ao vivo (Graph API) e devolve o resumo agregado.
// Reusa o token do Vault → token da Página. Admin + org. Nunca 5xx em erro lógico.
// v1: só Facebook Page. Instagram + Alcance (read_insights) = follow-ups.
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest } from 'next/server';
import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';
import { getPageAccessToken } from '@/lib/integrations/meta/leadforms';
import { fetchPagePosts, summarizeOrganic } from '@/lib/integrations/meta/organic';

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
    return metaJson({ error: 'instagram_pending', message: 'O Instagram precisa de ligar a conta IG à Página (em breve).', summary: null }, 200);
  }

  try {
    const pageToken = await getPageAccessToken(c.pageId, c.token);
    const posts = await fetchPagePosts(c.pageId, pageToken, since, until);
    const summary = summarizeOrganic(posts);
    return metaJson({ summary });
  } catch (e) {
    return metaJson({ error: e instanceof Error ? e.message : 'Não foi possível ler o orgânico da Página.' }, 200);
  }
}
