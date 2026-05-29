// GET /api/meta-ads/ad/[id] — estado vivo do anúncio (MA-EDIT).
// Devolve status + orçamento do adset directamente da Marketing API, para o
// modal de edição mostrar a verdade actual antes de qualquer alteração.
// Admin + org-scoped. Nunca 5xx em erro lógico.
export const dynamic = 'force-dynamic';

import { resolveMetaAdminContext, metaJson, assertAdBelongsToOrg } from '@/lib/integrations/meta/server';
import { getAdLiveState } from '@/lib/integrations/meta/write';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  try {
    await assertAdBelongsToOrg(c, id);
    const state = await getAdLiveState(id, c.token);
    return metaJson({ ok: true, state });
  } catch (e) {
    return metaJson({ error: e instanceof Error ? e.message : 'Erro desconhecido.' }, 200);
  }
}
