// POST /api/meta-ads/adset-probe — PROBE TEMPORÁRIO (MA-CREATE Fase 2 de-risco).
// Cria campanha + conjunto (LEADS/formulário) EM PAUSA e apaga a campanha
// (cascata) — para confirmar os parâmetros que a Meta exige no adset. Admin.
// A REMOVER depois de a Fase 2 estar pronta.
export const dynamic = 'force-dynamic';

import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';
import { createCampaign, createAdSet, deleteCampaign } from '@/lib/integrations/meta/write';

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return metaJson({ error: 'Forbidden' }, 403);
  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  let campaignId: string | null = null;
  try {
    const camp = await createCampaign(c.adAccountId, c.token, {
      name: 'PROBE CRM adset (apagar)',
      objective: 'OUTCOME_LEADS',
      status: 'PAUSED',
      adsetBudgetSharing: false,
    });
    campaignId = camp.id;
    const adset = await createAdSet(c.adAccountId, c.token, {
      name: 'PROBE conjunto (apagar)',
      campaignId: camp.id,
      dailyBudgetCents: 300,
      pageId: c.pageId,
      status: 'PAUSED',
    });
    // limpar (apagar campanha = apaga o conjunto em cascata)
    let cleaned = false;
    try { await deleteCampaign(camp.id, c.token); cleaned = true; } catch { /* deixa para limpeza manual */ }
    return metaJson({ ok: true, campaign_id: camp.id, adset_id: adset.id, cleaned });
  } catch (e) {
    // se a campanha foi criada mas o adset falhou, tenta apagar a campanha
    if (campaignId) { try { await deleteCampaign(campaignId, c.token); } catch { /* ignore */ } }
    return metaJson({ ok: false, error: e instanceof Error ? e.message : 'erro', campaign_id: campaignId });
  }
}
