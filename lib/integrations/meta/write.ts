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

async function graphPostJson(
  id: string,
  token: string,
  fields: Record<string, string>,
): Promise<Record<string, unknown>> {
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
  return json;
}

async function graphPost(id: string, token: string, fields: Record<string, string>): Promise<void> {
  await graphPostJson(id, token, fields);
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

export interface AdCreativeCopy {
  title: string | null;
  body: string | null;
  cta_type: string | null;
}

/**
 * Extrai a copy (título/texto/CTA) de um objecto `creative` da Graph API.
 * Função pura (sem rede) — partilhada pela leitura e pela edição; testável.
 * Os campos podem vir no creative directamente ou em object_story_spec
 * (link_data para link ads, video_data para vídeo).
 */
export function extractCopyFromCreative(creative: Record<string, unknown>): AdCreativeCopy {
  const oss = (creative.object_story_spec ?? {}) as Record<string, unknown>;
  const link = (oss.link_data ?? {}) as Record<string, unknown>;
  const video = (oss.video_data ?? {}) as Record<string, unknown>;
  const linkCta = (link.call_to_action ?? video.call_to_action ?? {}) as Record<string, unknown>;

  const title = (creative.title as string) || (link.name as string) || (video.title as string) || null;
  const body = (creative.body as string) || (link.message as string) || (video.message as string) || null;
  const cta = (creative.call_to_action_type as string) || (linkCta.type as string) || null;

  return { title: title || null, body: body || null, cta_type: cta || null };
}

/**
 * Lê a copy do criativo do anúncio (título, texto, CTA). Os campos podem vir
 * directamente no creative ou dentro de object_story_spec.link_data (link ads).
 */
export async function getAdCreativeCopy(adId: string, token: string): Promise<AdCreativeCopy> {
  const json = await graphGet(
    `${adId}?fields=creative{title,body,call_to_action_type,object_story_spec}`,
    token,
  );
  return extractCopyFromCreative((json.creative ?? {}) as Record<string, unknown>);
}

// ----------------------------------------------------------------------------
// MA-EDIT Tier 1 — editar o texto do anúncio.
// Na Meta os criativos são imutáveis: para "mudar a copy" lê-se o
// object_story_spec actual, clona-se com o texto novo, cria-se um criativo novo
// e aponta-se o anúncio a esse criativo. O anúncio volta a revisão e reinicia a
// aprendizagem (a UI avisa). As transformações de spec são puras (testáveis).
// ----------------------------------------------------------------------------

export interface AdCreativeFull {
  /** ID do criativo actual (informativo). */
  creative_id: string | null;
  /** object_story_spec clonável (ou null se o anúncio não o usa). */
  story_spec: Record<string, unknown> | null;
  /** Copy actual, para pré-preencher o formulário. */
  copy: AdCreativeCopy;
  /** Se a copy é editável por este tier (link_data ou video_data presentes). */
  editable: boolean;
  /** Motivo (PT) quando não é editável. */
  reason: string | null;
}

const DYNAMIC_REASON =
  'Este anúncio usa um criativo dinâmico (vários textos); a edição de texto chega num próximo tier.';
const NO_SPEC_REASON = 'Este anúncio não tem texto editável a partir do CRM.';

/** Decide editabilidade a partir de um `creative` da Graph API. Pura/testável. */
export function analyzeCreativeForEdit(creative: Record<string, unknown>): AdCreativeFull {
  const spec = (creative.object_story_spec ?? null) as Record<string, unknown> | null;
  const copy = extractCopyFromCreative(creative);
  let editable = false;
  let reason: string | null = null;
  if (spec && (spec.link_data || spec.video_data)) {
    editable = true;
  } else if (creative.asset_feed_spec) {
    reason = DYNAMIC_REASON;
  } else {
    reason = NO_SPEC_REASON;
  }
  return { creative_id: (creative.id as string) ?? null, story_spec: spec, copy, editable, reason };
}

/** Lê o criativo completo do anúncio (spec clonável + copy + editabilidade). */
export async function getAdCreativeFull(adId: string, token: string): Promise<AdCreativeFull> {
  const json = await graphGet(
    `${adId}?fields=creative{id,title,body,call_to_action_type,object_story_spec,asset_feed_spec}`,
    token,
  );
  return analyzeCreativeForEdit((json.creative ?? {}) as Record<string, unknown>);
}

/**
 * Aplica a copy nova a uma cópia profunda do object_story_spec. Pura/testável.
 * Só toca em link_data/video_data; preserva imagem, página, link e o `value` do
 * CTA existente. Devolve erro PT quando o spec não é editável por este tier.
 */
export function applyCopyToStorySpec(
  spec: Record<string, unknown>,
  copy: AdCreativeCopy,
): { ok: true; spec: Record<string, unknown> } | { ok: false; reason: string } {
  if (!spec || typeof spec !== 'object') return { ok: false, reason: NO_SPEC_REASON };
  const clone = JSON.parse(JSON.stringify(spec)) as Record<string, unknown>;
  const link = clone.link_data as Record<string, unknown> | undefined;
  const video = clone.video_data as Record<string, unknown> | undefined;

  if (link && typeof link === 'object') {
    if (copy.title !== null) link.name = copy.title;
    if (copy.body !== null) link.message = copy.body;
    if (copy.cta_type) {
      const existing = (link.call_to_action as Record<string, unknown>) ?? {};
      const value = (existing.value as Record<string, unknown>) ?? (link.link ? { link: link.link } : undefined);
      link.call_to_action = value ? { type: copy.cta_type, value } : { type: copy.cta_type };
    }
    return { ok: true, spec: clone };
  }

  if (video && typeof video === 'object') {
    if (copy.title !== null) video.title = copy.title;
    if (copy.body !== null) video.message = copy.body;
    if (copy.cta_type) {
      const existing = (video.call_to_action as Record<string, unknown>) ?? {};
      const value = existing.value as Record<string, unknown> | undefined;
      video.call_to_action = value ? { type: copy.cta_type, value } : { type: copy.cta_type };
    }
    return { ok: true, spec: clone };
  }

  return { ok: false, reason: DYNAMIC_REASON };
}

/**
 * Edita o texto do anúncio: cria um criativo novo (clonando o spec actual com a
 * copy nova) e aponta o anúncio a esse criativo. Devolve o id do criativo novo.
 * `adAccountId` no formato `act_<id>`. Lança Error PT em falha.
 */
export async function updateAdCopy(
  adId: string,
  adAccountId: string | null,
  token: string,
  copy: AdCreativeCopy,
): Promise<{ creative_id: string }> {
  if (!adAccountId) throw new Error('Conta de anúncios não seleccionada.');
  const full = await getAdCreativeFull(adId, token);
  if (!full.editable || !full.story_spec) {
    throw new Error(full.reason ?? NO_SPEC_REASON);
  }
  const built = applyCopyToStorySpec(full.story_spec, copy);
  if (!built.ok) throw new Error(built.reason);

  const created = await graphPostJson(`${adAccountId}/adcreatives`, token, {
    name: 'Texto editado via Foco Imo CRM',
    object_story_spec: JSON.stringify(built.spec),
  });
  const newId = (created.id as string) || '';
  if (!newId) throw new Error('A Meta não devolveu o criativo novo.');

  await graphPost(adId, token, { creative: JSON.stringify({ creative_id: newId }) });
  return { creative_id: newId };
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
