// GET /api/meta-ads/geo-search?q=... — pesquisa cidades/localidades na Meta
// (adgeolocation) para o selector de localização do builder (MA-CREATE Fase 2).
// Admin + org-scoped. Nunca 5xx: devolve lista vazia + erro em falha.
export const dynamic = 'force-dynamic';

import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';
import { searchAdGeoLocations } from '@/lib/integrations/meta/write';

export async function GET(req: Request) {
  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  const q = new URL(req.url).searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return metaJson({ results: [] });

  try {
    const results = await searchAdGeoLocations(c.token, q);
    return metaJson({ results });
  } catch (e) {
    return metaJson({ results: [], error: e instanceof Error ? e.message : 'Pesquisa indisponível.' }, 200);
  }
}
