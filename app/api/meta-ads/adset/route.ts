// POST /api/meta-ads/adset — cria um conjunto de anúncios (MA-CREATE, Fase 2).
// Encadeado ao campaign_id criado na Fase 1. Cria SEMPRE em pausa, com os
// defaults do João: orçamento no conjunto, "maior volume", Advantage+.
// Admin + org-scoped + audit. Nunca 5xx em erro lógico.
export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';
import { createAdSet, MIN_DAILY_BUDGET_CENTS } from '@/lib/integrations/meta/write';

const Schema = z.object({
  campaignId: z.string().min(1),
  name: z.string().min(1).max(200),
  conversion: z.enum(['form', 'site', 'whatsapp']).default('form'),
  dailyBudgetCents: z.number().int().positive(),
  geoCity: z
    .object({ key: z.string().min(1), name: z.string().optional(), radius: z.number().int().min(1).max(80) })
    .nullable()
    .optional(),
  advantageAudience: z.boolean().default(true),
});

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return metaJson({ error: 'Forbidden' }, 403);

  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  let body: z.infer<typeof Schema>;
  try {
    body = Schema.parse(await req.json());
  } catch {
    return metaJson({ error: 'Pedido inválido.' }, 400);
  }

  if (body.dailyBudgetCents < MIN_DAILY_BUDGET_CENTS) {
    return metaJson(
      { error: `O orçamento diário mínimo desta conta é ${(MIN_DAILY_BUDGET_CENTS / 100).toFixed(2).replace('.', ',')} €.` },
      200,
    );
  }

  try {
    const { id } = await createAdSet(c.adAccountId, c.token, {
      name: body.name,
      campaignId: body.campaignId,
      dailyBudgetCents: body.dailyBudgetCents,
      pageId: c.pageId,
      conversion: body.conversion,
      geoCities: body.geoCity ? [{ key: body.geoCity.key, radius: body.geoCity.radius }] : undefined,
      geoCountries: ['PT'],
      advantageAudience: body.advantageAudience,
    });

    await c.admin.from('audit_logs').insert({
      user_id: c.userId,
      organization_id: c.orgId,
      action: 'META_ADSET_CREATE',
      resource_type: 'meta_adset',
      resource_id: c.integrationId,
      severity: 'warning',
      details: {
        adset_id: id,
        campaign_id: body.campaignId,
        name: body.name,
        conversion: body.conversion,
        daily_budget_cents: body.dailyBudgetCents,
        geo: body.geoCity ? { key: body.geoCity.key, name: body.geoCity.name, radius: body.geoCity.radius } : { country: 'PT' },
      },
    });

    return metaJson({ ok: true, adset_id: id });
  } catch (e) {
    return metaJson({ error: e instanceof Error ? e.message : 'Não foi possível criar o conjunto.' }, 200);
  }
}
