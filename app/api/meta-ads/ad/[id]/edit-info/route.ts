// GET /api/meta-ads/ad/[id]/edit-info — estado editável do criativo do anúncio.
// Devolve o tipo (simples/dinâmico), se é editável, a copy actual (simples) ou
// as variações de texto (dinâmico) para pré-preencher o editor. Admin +
// org-scoped. Nunca 5xx em erro lógico.
export const dynamic = 'force-dynamic';

import { resolveMetaAdminContext, metaJson, assertAdBelongsToOrg } from '@/lib/integrations/meta/server';
import { getAdCreativeFull } from '@/lib/integrations/meta/write';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  try {
    await assertAdBelongsToOrg(c, id);
    const full = await getAdCreativeFull(id, c.token);
    return metaJson({
      ok: true,
      kind: full.kind,
      editable: full.editable,
      reason: full.reason,
      copy: full.copy,
      texts: full.texts,
    });
  } catch (e) {
    return metaJson({ error: e instanceof Error ? e.message : 'Não foi possível ler o criativo.' }, 200);
  }
}
