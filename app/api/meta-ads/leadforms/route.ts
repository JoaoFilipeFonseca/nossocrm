// GET /api/meta-ads/leadforms — lista os formulários de leads da Página (para os
// ligar a um anúncio no construtor, MA-CREATE Fase 3, destino Formulário).
// Admin + org-scoped. Nunca 5xx: devolve lista vazia + erro em falha.
export const dynamic = 'force-dynamic';

import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';
import { listLeadForms } from '@/lib/integrations/meta/leadforms';

export async function GET() {
  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  if (!c.pageId) return metaJson({ forms: [], error: 'Página não seleccionada.' }, 200);

  try {
    const forms = await listLeadForms(c.pageId, c.token);
    return metaJson({ forms });
  } catch (e) {
    return metaJson({ forms: [], error: e instanceof Error ? e.message : 'Não foi possível listar os formulários.' }, 200);
  }
}
