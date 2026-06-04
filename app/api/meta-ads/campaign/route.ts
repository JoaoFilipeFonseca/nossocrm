// POST /api/meta-ads/campaign — cria uma campanha (MA-CREATE, Fase 1).
// Cria SEMPRE em pausa, com os defaults do João: orçamento no conjunto (sem
// CBO, sem partilha de 20%). Objectivo limitado a Leads/Tráfego/Interação.
// Admin + org-scoped + audit. Nunca 5xx em erro lógico.
export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { resolveMetaAdminContext, metaJson } from '@/lib/integrations/meta/server';
import { createCampaign } from '@/lib/integrations/meta/write';

// Objectivos que o João usa → enum da Meta (Outcome-Driven Ad Experiences).
const OBJECTIVE_MAP: Record<string, string> = {
  leads: 'OUTCOME_LEADS',
  trafego: 'OUTCOME_TRAFFIC',
  interacao: 'OUTCOME_ENGAGEMENT',
};

const Schema = z.object({
  name: z.string().min(1).max(200),
  objective: z.enum(['leads', 'trafego', 'interacao']),
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

  const objective = OBJECTIVE_MAP[body.objective];

  try {
    const { id } = await createCampaign(c.adAccountId, c.token, {
      name: body.name,
      objective,
      status: 'PAUSED',
      adsetBudgetSharing: false, // sem partilha de 20% (decisão do João)
    });

    await c.admin.from('audit_logs').insert({
      user_id: c.userId,
      organization_id: c.orgId,
      action: 'META_CAMPAIGN_CREATE',
      resource_type: 'meta_campaign',
      resource_id: c.integrationId,
      severity: 'warning',
      details: { campaign_id: id, name: body.name, objective },
    });

    return metaJson({ ok: true, campaign_id: id });
  } catch (e) {
    return metaJson({ error: e instanceof Error ? e.message : 'Não foi possível criar a campanha.' }, 200);
  }
}
