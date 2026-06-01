// GET /api/meta-ads/ad/[id]/drilldown — MA-DRILLDOWN.
// Tudo sobre UM anúncio: criativo + copy, métricas vitalícias, e a LISTA de
// leads (contactos) e negócios atribuídos a este anúncio (attribution.ad_id).
// A copy é buscada à Meta e cacheada na 1.ª vez. Admin + org-scoped. Nunca 5xx.
export const dynamic = 'force-dynamic';

import { resolveMetaAdminContext, metaJson, assertAdBelongsToOrg } from '@/lib/integrations/meta/server';
import { getAdCreativeCopy } from '@/lib/integrations/meta/write';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  try {
    await assertAdBelongsToOrg(c, id);

  // Criativo guardado (imagem/copy). Se faltar a copy, busca à Meta e cacheia.
  const { data: creative } = await c.admin
    .from('ad_creatives')
    .select('ad_id, thumbnail_url, image_url, creative_type, permalink, title, body, cta_type')
    .eq('organization_id', c.orgId)
    .eq('ad_id', id)
    .maybeSingle();

  let copy = creative
    ? { title: creative.title as string | null, body: creative.body as string | null, cta_type: creative.cta_type as string | null }
    : { title: null, body: null, cta_type: null };
  if (!copy.title && !copy.body) {
    try {
      copy = await getAdCreativeCopy(id, c.token);
      await c.admin
        .from('ad_creatives')
        .update({ title: copy.title, body: copy.body, cta_type: copy.cta_type })
        .eq('organization_id', c.orgId)
        .eq('ad_id', id);
    } catch { /* copy fica null; não bloqueia o resto */ }
  }

  // Métricas vitalícias (soma de todas as linhas de ad_insights deste anúncio).
  const { data: insights } = await c.admin
    .from('ad_insights')
    .select('spend, impressions, clicks, leads, ad_name, adset_name, campaign_name')
    .eq('organization_id', c.orgId)
    .eq('ad_id', id);
  let spend = 0, impressions = 0, clicks = 0, metaLeads = 0;
  let adName: string | null = null, adsetName: string | null = null, campaignName: string | null = null;
  for (const r of insights ?? []) {
    spend += Number((r as { spend: number }).spend) || 0;
    impressions += Number((r as { impressions: number }).impressions) || 0;
    clicks += Number((r as { clicks: number }).clicks) || 0;
    metaLeads += Number((r as { leads: number }).leads) || 0;
    adName = adName ?? (r as { ad_name: string | null }).ad_name;
    adsetName = adsetName ?? (r as { adset_name: string | null }).adset_name;
    campaignName = campaignName ?? (r as { campaign_name: string | null }).campaign_name;
  }

  // Leads (contactos) atribuídos a este anúncio.
  const { data: contacts } = await c.admin
    .from('contacts')
    .select('id, name, phone, email, created_at')
    .eq('organization_id', c.orgId)
    .eq('attribution->>ad_id', id)
    .order('created_at', { ascending: false });

  // Negócios atribuídos a este anúncio.
  const { data: deals } = await c.admin
    .from('deals')
    .select('id, title, value, is_won, is_lost, created_at')
    .eq('organization_id', c.orgId)
    .eq('attribution->>ad_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  let efectivoCents = 0;
  let wonCount = 0;
  const dealsOut = (deals ?? []).map((d) => {
    const won = (d as { is_won: boolean }).is_won;
    const lost = (d as { is_lost: boolean }).is_lost;
    const value = Number((d as { value: number }).value) || 0;
    if (won) { wonCount += 1; efectivoCents += Math.round(value * 100); }
    return {
      id: (d as { id: string }).id,
      title: (d as { title: string }).title,
      value_cents: Math.round(value * 100),
      estado: won ? 'Ganho' : lost ? 'Perdido' : 'Aberto',
      created_at: (d as { created_at: string }).created_at,
    };
  });

  const leadsCount = (contacts ?? []).length;
  const spendCents = Math.round(spend * 100);

  return metaJson({
    ok: true,
    ad: { ad_id: id, ad_name: adName, adset_name: adsetName, campaign_name: campaignName },
    creative: creative
      ? {
          thumbnail_url: creative.thumbnail_url, image_url: creative.image_url,
          creative_type: creative.creative_type, permalink: creative.permalink,
          title: copy.title, body: copy.body, cta_type: copy.cta_type,
        }
      : { thumbnail_url: null, image_url: null, creative_type: null, permalink: null, ...copy },
    metrics: {
      spend_cents: spendCents, impressions, clicks, meta_leads: metaLeads,
      crm_leads: leadsCount,
      cpl_cents: leadsCount > 0 ? Math.round(spendCents / leadsCount) : null,
      won_count: wonCount,
      efectivo_cents: efectivoCents,
      cpa_cents: wonCount > 0 ? Math.round(spendCents / wonCount) : null,
      roas: spendCents > 0 ? efectivoCents / spendCents : null,
    },
    leads: (contacts ?? []).map((ct) => ({
      id: (ct as { id: string }).id,
      name: (ct as { name: string | null }).name,
      phone: (ct as { phone: string | null }).phone,
      email: (ct as { email: string | null }).email,
      created_at: (ct as { created_at: string }).created_at,
    })),
    deals: dealsOut,
  });
  } catch (e) {
    return metaJson({ error: e instanceof Error ? e.message : 'Não foi possível carregar os dados do anúncio.' }, 200);
  }
}
