// ============================================================================
// write.ts — escrita na Marketing API (MA-EDIT, tier fácil)
// ============================================================================
// Épico Meta Ads — edição do anúncio a partir do CRM.
//   - getAdLiveState: estado vivo do anúncio (status + orçamento editável).
//   - setAdStatus: pausar / reactivar o anúncio (nível anúncio).
//   - setBudget: alterar o orçamento no nó certo (adset OU campanha/CBO).
// O orçamento pode viver no adset (afecta os anúncios do adset) ou na campanha
// (CBO, afecta toda a campanha). Expomos um alvo de edição unificado
// (budget_id/cents/kind) para a UI não ter de saber a topologia.
// Tudo server-only. Precisa do scope `ads_management` no token (ver config.ts).
// Em falha lança Error com mensagem PT (a Graph API é a autoridade final).
// ============================================================================
import 'server-only';
import { META_GRAPH_BASE } from './config';

/** Onde vive o orçamento: no adset, na campanha (CBO) ou inexistente. */
export type BudgetLevel = 'adset' | 'campaign' | 'none';

export interface AdLiveState {
  ad_id: string;
  ad_name: string | null;
  /** Estado configurado pelo utilizador: ACTIVE | PAUSED | ARCHIVED | DELETED. */
  status: string;
  /** Estado efectivo (inclui pausas herdadas do adset/campanha/conta). */
  effective_status: string;
  adset_id: string | null;
  adset_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  /** Nível onde o orçamento é editável. 'none' = sem orçamento editável. */
  budget_level: BudgetLevel;
  /** Nó (adset ou campanha) ao qual se aplica a alteração de orçamento. */
  budget_id: string | null;
  /** Orçamento actual em cêntimos da moeda da conta. */
  budget_cents: number | null;
  /** Tipo de orçamento em uso (diário ou total). */
  budget_kind: 'daily' | 'lifetime' | null;
}

function toCents(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'string' ? parseInt(v, 10) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

async function graphGet(path: string, token: string): Promise<Record<string, unknown>> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${META_GRAPH_BASE}/${path}${sep}access_token=${encodeURIComponent(token)}`, {
    headers: { 'User-Agent': 'FocoImoCRM/1.0' },
  });
  let json: Record<string, unknown> = {};
  try { json = (await res.json()) as Record<string, unknown>; } catch { /* corpo não-JSON */ }
  if (!res.ok) {
    const err = json?.error as { message?: string } | undefined;
    throw new Error(err?.message || `Erro da Graph API (HTTP ${res.status}).`);
  }
  return json;
}

async function graphPost(id: string, token: string, fields: Record<string, string>): Promise<void> {
  const body = new URLSearchParams({ ...fields, access_token: token });
  const res = await fetch(`${META_GRAPH_BASE}/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'FocoImoCRM/1.0' },
    body: body.toString(),
  });
  let json: Record<string, unknown> = {};
  try { json = (await res.json()) as Record<string, unknown>; } catch { /* corpo não-JSON */ }
  if (!res.ok) {
    const err = json?.error as { message?: string } | undefined;
    throw new Error(err?.message || `Erro da Graph API (HTTP ${res.status}).`);
  }
}

/** Lê o estado vivo do anúncio (status + orçamento editável adset/campanha). */
export async function getAdLiveState(adId: string, token: string): Promise<AdLiveState> {
  const json = await graphGet(
    `${adId}?fields=name,status,effective_status,adset{id,name,daily_budget,lifetime_budget,campaign{id,name,daily_budget,lifetime_budget}}`,
    token,
  );

  const adset = (json.adset ?? {}) as Record<string, unknown>;
  const campaign = (adset.campaign ?? {}) as Record<string, unknown>;

  const adsetDaily = toCents(adset.daily_budget);
  const adsetLifetime = toCents(adset.lifetime_budget);
  const campDaily = toCents(campaign.daily_budget);
  const campLifetime = toCents(campaign.lifetime_budget);

  let budgetLevel: BudgetLevel = 'none';
  let budgetId: string | null = null;
  let budgetCents: number | null = null;
  let budgetKind: 'daily' | 'lifetime' | null = null;
  if (adsetDaily || adsetLifetime) {
    budgetLevel = 'adset';
    budgetId = (adset.id as string) ?? null;
    budgetCents = adsetDaily ?? adsetLifetime;
    budgetKind = adsetDaily ? 'daily' : 'lifetime';
  } else if (campDaily || campLifetime) {
    budgetLevel = 'campaign';
    budgetId = (campaign.id as string) ?? null;
    budgetCents = campDaily ?? campLifetime;
    budgetKind = campDaily ? 'daily' : 'lifetime';
  }

  return {
    ad_id: adId,
    ad_name: (json.name as string) ?? null,
    status: (json.status as string) ?? 'UNKNOWN',
    effective_status: (json.effective_status as string) ?? 'UNKNOWN',
    adset_id: (adset.id as string) ?? null,
    adset_name: (adset.name as string) ?? null,
    campaign_id: (campaign.id as string) ?? null,
    campaign_name: (campaign.name as string) ?? null,
    budget_level: budgetLevel,
    budget_id: budgetId,
    budget_cents: budgetCents,
    budget_kind: budgetKind,
  };
}

/** Pausa ou reactiva o anúncio (nível anúncio). status: 'ACTIVE' | 'PAUSED'. */
export async function setAdStatus(adId: string, token: string, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
  await graphPost(adId, token, { status });
}

/**
 * Altera o orçamento no nó indicado (adset ou campanha). `kind` = 'daily' |
 * 'lifetime', `cents` em cêntimos da moeda da conta.
 */
export async function setBudget(
  nodeId: string,
  token: string,
  kind: 'daily' | 'lifetime',
  cents: number,
): Promise<void> {
  const field = kind === 'daily' ? 'daily_budget' : 'lifetime_budget';
  await graphPost(nodeId, token, { [field]: String(cents) });
}
