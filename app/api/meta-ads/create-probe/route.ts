// POST /api/meta-ads/create-probe — PROBE TEMPORÁRIO (MA-CREATE de-risco).
// Cria uma campanha EM PAUSA e apaga-a logo a seguir, só para confirmar se a
// conta/app tem capacidade de CRIAR objectos de anúncio no tier actual (ou se
// dá o mesmo "(#3) capability" do vídeo). Admin + org-scoped. A REMOVER depois
// de decidir o MA-CREATE.
export const dynamic = 'force-dynamic';

import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';
import { createCampaign, deleteCampaign } from '@/lib/integrations/meta/write';

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return metaJson({ error: 'Forbidden' }, 403);

  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  try {
    const { id } = await createCampaign(c.adAccountId, c.token, {
      name: 'PROBE CRM (apagar)',
      objective: 'OUTCOME_LEADS',
      status: 'PAUSED',
    });
    let deleted = false;
    let deleteErr: string | null = null;
    try {
      await deleteCampaign(id, c.token);
      deleted = true;
    } catch (e) {
      deleteErr = e instanceof Error ? e.message : 'erro';
    }
    return metaJson({ ok: true, campaign_id: id, deleted, deleteErr });
  } catch (e) {
    return metaJson({ ok: false, error: e instanceof Error ? e.message : 'erro' });
  }
}
