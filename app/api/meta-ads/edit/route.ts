// POST /api/meta-ads/edit — edição do anúncio (MA-EDIT, tier fácil).
// Acções:
//   - pause_ad       { ad_id }            -> status PAUSED (nível anúncio)
//   - resume_ad      { ad_id }            -> status ACTIVE (nível anúncio)
//   - set_adset_budget { ad_id, amount_cents, kind? } -> orçamento do adset
//
// Escreve em campanhas LIVE (dinheiro). Por isso: admin + org-scoped + mesma
// origem; valida que o anúncio pertence à org; relê o estado vivo antes de
// alterar; e regista SEMPRE em `audit_logs` (antes/depois). Nunca 5xx em erro
// lógico — devolve mensagem PT e 200. A confirmação explícita é feita na UI.
export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { resolveMetaAdminContext, metaJson, assertAdBelongsToOrg } from '@/lib/integrations/meta/server';
import { getAdLiveState, setAdStatus, setBudget } from '@/lib/integrations/meta/write';

// Piso de segurança do orçamento (1,00 da moeda da conta). A Meta tem mínimos
// próprios por moeda e é a autoridade final; isto só evita zeros/enganos.
const MIN_BUDGET_CENTS = 100;
const MAX_BUDGET_CENTS = 100_000_00; // 100.000 — trava enganos grosseiros.

const Schema = z.object({
  // set_budget edita o orçamento no nó certo (adset ou campanha/CBO).
  // set_adset_budget mantém-se como alias para compatibilidade.
  action: z.enum(['pause_ad', 'resume_ad', 'set_budget', 'set_adset_budget']),
  ad_id: z.string().min(1),
  amount_cents: z.number().int().positive().optional(),
  kind: z.enum(['daily', 'lifetime']).optional(),
});

export async function POST(req: Request) {
  if (!isAllowedOrigin(req)) return metaJson({ error: 'Forbidden' }, 403);

  const resolved = await resolveMetaAdminContext();
  if (resolved.error) return resolved.error;
  const c = resolved.ctx;

  let payload: z.infer<typeof Schema>;
  try {
    payload = Schema.parse(await req.json());
  } catch {
    return metaJson({ error: 'Pedido inválido.' }, 400);
  }
  const { action, ad_id } = payload;

  try {
    const { adName } = await assertAdBelongsToOrg(c, ad_id);

    // ---- Pausar / reactivar (nível anúncio) -------------------------------
    if (action === 'pause_ad' || action === 'resume_ad') {
      const before = await getAdLiveState(ad_id, c.token);
      const next = action === 'pause_ad' ? 'PAUSED' : 'ACTIVE';
      await setAdStatus(ad_id, c.token, next);

      await c.admin.from('audit_logs').insert({
        user_id: c.userId,
        organization_id: c.orgId,
        action: action === 'pause_ad' ? 'META_AD_PAUSE' : 'META_AD_RESUME',
        resource_type: 'meta_ad',
        resource_id: c.integrationId,
        severity: 'warning',
        details: {
          ad_id,
          ad_name: adName ?? before.ad_name,
          status_before: before.status,
          status_after: next,
        },
      });

      return metaJson({ ok: true, status: next });
    }

    // ---- Orçamento (adset ou campanha/CBO) -------------------------------
    // Relê o estado vivo: descobre o nó certo (adset ou campanha), o tipo de
    // orçamento real e o valor actual. Não confiamos no cliente para o nó nem
    // para o tipo (não se pode misturar daily com lifetime).
    const live = await getAdLiveState(ad_id, c.token);
    if (live.budget_level === 'none' || !live.budget_id || !live.budget_kind) {
      return metaJson({ error: 'Este anúncio não tem orçamento editável.' }, 200);
    }

    const amount = payload.amount_cents;
    if (!amount || amount < MIN_BUDGET_CENTS || amount > MAX_BUDGET_CENTS) {
      return metaJson({ error: 'Valor de orçamento inválido.' }, 400);
    }

    const liveKind = live.budget_kind;
    const kind = payload.kind ?? liveKind;
    if (kind !== liveKind) {
      return metaJson({ error: `Este orçamento é ${liveKind === 'daily' ? 'diário' : 'total'}.` }, 200);
    }

    const isCampaign = live.budget_level === 'campaign';
    await setBudget(live.budget_id, c.token, kind, amount);

    await c.admin.from('audit_logs').insert({
      user_id: c.userId,
      organization_id: c.orgId,
      action: isCampaign ? 'META_CAMPAIGN_BUDGET' : 'META_ADSET_BUDGET',
      resource_type: isCampaign ? 'meta_campaign' : 'meta_adset',
      resource_id: c.integrationId,
      severity: 'warning',
      details: {
        ad_id,
        ad_name: adName ?? live.ad_name,
        budget_level: live.budget_level,
        node_id: live.budget_id,
        node_name: isCampaign ? live.campaign_name : live.adset_name,
        budget_kind: kind,
        cents_before: live.budget_cents,
        cents_after: amount,
      },
    });

    return metaJson({ ok: true, level: live.budget_level, kind, cents: amount });
  } catch (e) {
    return metaJson({ error: e instanceof Error ? e.message : 'Erro desconhecido.' }, 200);
  }
}
