// GET /api/meta-ads/reach-estimate?cityKey=&radius=&conversion= — estimativa de
// público atingível (delivery_estimate) para a localização escolhida no builder
// (MA-CREATE Fase 2). Admin + org-scoped. Nunca 5xx: devolve null + erro.
export const dynamic = 'force-dynamic';

import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';
import { buildAdSetTargeting, conversionToAdSetParams, estimateReach, type AdSetConversion } from '@/lib/integrations/meta/write';

export async function GET(req: Request) {
  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  const sp = new URL(req.url).searchParams;
  const cityKey = sp.get('cityKey')?.trim() || null;
  const radius = Number(sp.get('radius') ?? '0');
  const conversion = (sp.get('conversion') ?? 'form') as AdSetConversion;

  const targeting = buildAdSetTargeting({
    geoCities: cityKey && radius > 0 ? [{ key: cityKey, radius }] : undefined,
    geoCountries: ['PT'],
    advantageAudience: true,
  });
  const { optimizationGoal } = conversionToAdSetParams(conversion);

  try {
    const estimate = await estimateReach(c.adAccountId, c.token, targeting, optimizationGoal);
    return metaJson({ estimate });
  } catch (e) {
    return metaJson({ estimate: null, error: e instanceof Error ? e.message : 'Estimativa indisponível.' }, 200);
  }
}
