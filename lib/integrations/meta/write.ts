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

// Constrói uma mensagem de erro PT rica a partir do corpo da Graph API. A Meta
// devolve frequentemente "Invalid parameter" genérico, com o detalhe útil em
// error_user_title/error_user_msg/error_subcode. Surfa-los para o utilizador.
// Dicas accionáveis (PT) para subcódigos conhecidos da Meta — transformam erros
// crípticos em passos concretos para o consultor. Ex.: ToS da Geração de Leads.
const META_SUBCODE_HINTS: Record<number, string> = {
  1892181:
    'Aceite os Termos da Geração de Leads no Gestor de Anúncios da Meta (Definições da conta > Termos e políticas > Termos da Geração de Leads), com a Página seleccionada. Depois repita.',
};

export function metaErrorMessage(json: Record<string, unknown>, status: number): string {
  const err = (json?.error ?? {}) as {
    message?: string; error_user_title?: string; error_user_msg?: string; error_subcode?: number;
  };
  const detail = err.error_user_msg || err.error_user_title;
  const base = err.message || `Erro da Graph API (HTTP ${status}).`;
  const subcode = err.error_subcode ? ` (subcódigo ${err.error_subcode})` : '';
  const hint = err.error_subcode && META_SUBCODE_HINTS[err.error_subcode]
    ? ` ${META_SUBCODE_HINTS[err.error_subcode]}`
    : '';
  return detail && detail !== base ? `${base}: ${detail}${subcode}${hint}` : `${base}${subcode}${hint}`;
}

async function graphGet(path: string, token: string): Promise<Record<string, unknown>> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${META_GRAPH_BASE}/${path}${sep}access_token=${encodeURIComponent(token)}`, {
    headers: { 'User-Agent': 'FocoImoCRM/1.0' },
  });
  let json: Record<string, unknown> = {};
  try { json = (await res.json()) as Record<string, unknown>; } catch { /* corpo não-JSON */ }
  if (!res.ok) throw new Error(metaErrorMessage(json, res.status));
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
  if (!res.ok) throw new Error(metaErrorMessage(json, res.status));
  return json;
}

async function graphPost(id: string, token: string, fields: Record<string, string>): Promise<void> {
  await graphPostJson(id, token, fields);
}

async function graphDelete(id: string, token: string): Promise<void> {
  const res = await fetch(`${META_GRAPH_BASE}/${id}?access_token=${encodeURIComponent(token)}`, {
    method: 'DELETE',
    headers: { 'User-Agent': 'FocoImoCRM/1.0' },
  });
  let json: Record<string, unknown> = {};
  try { json = (await res.json()) as Record<string, unknown>; } catch { /* corpo não-JSON */ }
  if (!res.ok) throw new Error(metaErrorMessage(json, res.status));
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

/** Variações de texto de um criativo dinâmico (asset_feed_spec). */
export interface DynamicTexts {
  titles: string[];
  bodies: string[];
  descriptions: string[];
}

/** Media actual do anúncio (imagem ou vídeo), para mostrar na edição. */
export interface AdMedia {
  /** 'image' | 'video' | 'none'. */
  kind: 'image' | 'video' | 'none';
  /** Hash da imagem na biblioteca da conta (quando é imagem). */
  image_hash: string | null;
  /** URL da imagem actual (para pré-visualizar na UI). */
  image_url: string | null;
  /** ID do vídeo (quando é vídeo). */
  video_id: string | null;
  /** Miniatura do vídeo (para pré-visualizar na UI). */
  thumbnail_url: string | null;
}

export interface AdCreativeFull {
  /** ID do criativo actual (informativo). */
  creative_id: string | null;
  /** Tipo de criativo: 'story' (1 texto), 'dynamic' (vários), 'none'. */
  kind: 'story' | 'dynamic' | 'none';
  /** object_story_spec clonável (ou null se o anúncio não o usa). */
  story_spec: Record<string, unknown> | null;
  /** asset_feed_spec clonável (só nos dinâmicos). */
  asset_feed_spec: Record<string, unknown> | null;
  /** Copy actual (criativo simples), para pré-preencher o formulário. */
  copy: AdCreativeCopy;
  /** Variações de texto (criativo dinâmico), para pré-preencher. */
  texts: DynamicTexts;
  /** Media actual (imagem/vídeo) — para o editor de imagem/vídeo (Tier 2). */
  media: AdMedia;
  /** Se a copy é editável a partir do CRM. */
  editable: boolean;
  /** Motivo (PT) quando não é editável. */
  reason: string | null;
}

const NO_SPEC_REASON = 'Este anúncio não tem texto editável a partir do CRM.';

/** Extrai as variações de texto de um asset_feed_spec. Pura/testável. */
export function extractTextsFromAssetFeedSpec(afs: Record<string, unknown>): DynamicTexts {
  const pick = (key: string): string[] => {
    const arr = afs?.[key];
    if (!Array.isArray(arr)) return [];
    return arr
      .map((it) => (it && typeof it === 'object' ? (it as { text?: unknown }).text : it))
      .filter((t): t is string => typeof t === 'string' && t.length > 0);
  };
  return { titles: pick('titles'), bodies: pick('bodies'), descriptions: pick('descriptions') };
}

/**
 * Lê a media actual (imagem/vídeo) de um `creative` da Graph API. Pura/testável.
 * O vídeo tem precedência (um anúncio de vídeo pode ter imagem de miniatura).
 * Procura no object_story_spec (link_data/video_data) e no asset_feed_spec.
 */
export function mediaFromCreative(creative: Record<string, unknown>): AdMedia {
  const oss = (creative.object_story_spec ?? {}) as Record<string, unknown>;
  const link = (oss.link_data ?? {}) as Record<string, unknown>;
  const video = (oss.video_data ?? {}) as Record<string, unknown>;
  const afs = (creative.asset_feed_spec ?? {}) as Record<string, unknown>;
  const afsImages = Array.isArray(afs.images) ? (afs.images as Record<string, unknown>[]) : [];
  const afsVideos = Array.isArray(afs.videos) ? (afs.videos as Record<string, unknown>[]) : [];

  if (video.video_id) {
    return {
      kind: 'video',
      image_hash: null,
      image_url: (video.image_url as string) ?? null,
      video_id: video.video_id as string,
      thumbnail_url: (video.image_url as string) ?? null,
    };
  }
  if (afsVideos.length > 0 && afsVideos[0].video_id) {
    const v = afsVideos[0];
    return {
      kind: 'video',
      image_hash: null,
      image_url: (v.url as string) ?? (v.thumbnail_url as string) ?? null,
      video_id: (v.video_id as string) ?? null,
      thumbnail_url: (v.thumbnail_url as string) ?? null,
    };
  }
  if (link.image_hash) {
    return {
      kind: 'image',
      image_hash: link.image_hash as string,
      image_url: (link.picture as string) ?? (link.image_url as string) ?? null,
      video_id: null,
      thumbnail_url: null,
    };
  }
  if (afsImages.length > 0 && afsImages[0].hash) {
    const i = afsImages[0];
    return {
      kind: 'image',
      image_hash: (i.hash as string) ?? null,
      image_url: (i.url as string) ?? null,
      video_id: null,
      thumbnail_url: null,
    };
  }
  return { kind: 'none', image_hash: null, image_url: null, video_id: null, thumbnail_url: null };
}

/** Decide editabilidade a partir de um `creative` da Graph API. Pura/testável. */
export function analyzeCreativeForEdit(creative: Record<string, unknown>): AdCreativeFull {
  const spec = (creative.object_story_spec ?? null) as Record<string, unknown> | null;
  const afs = (creative.asset_feed_spec ?? null) as Record<string, unknown> | null;
  const copy = extractCopyFromCreative(creative);
  const texts = afs ? extractTextsFromAssetFeedSpec(afs) : { titles: [], bodies: [], descriptions: [] };
  const media = mediaFromCreative(creative);

  let kind: 'story' | 'dynamic' | 'none' = 'none';
  let editable = false;
  let reason: string | null = null;
  if (spec && (spec.link_data || spec.video_data)) {
    kind = 'story';
    editable = true;
  } else if (afs && (texts.titles.length > 0 || texts.bodies.length > 0)) {
    kind = 'dynamic';
    editable = true;
  } else {
    reason = NO_SPEC_REASON;
  }
  return {
    creative_id: (creative.id as string) ?? null,
    kind,
    story_spec: spec,
    asset_feed_spec: afs,
    copy,
    texts,
    media,
    editable,
    reason,
  };
}

/** Lê o criativo completo do anúncio (spec clonável + copy + media + editabilidade). */
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

  return { ok: false, reason: NO_SPEC_REASON };
}

/**
 * Limpa um object_story_spec lido da Graph API para poder ser usado a CRIAR um
 * criativo novo. A leitura devolve campos eco/read-only que o endpoint de
 * criação rejeita ("Invalid parameter"). Pura/testável. Regras:
 *  - link_data/video_data: se houver `image_hash`, remove `picture`/`image_url`
 *    (URL eco), pois enviar ambos colide.
 *  - remove `caption` (derivado do domínio do link, read-only no create).
 */
export function sanitizeStorySpecForCreate(spec: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(spec)) as Record<string, unknown>;
  const prune = (node: unknown) => {
    if (!node || typeof node !== 'object') return;
    const n = node as Record<string, unknown>;
    if (n.image_hash) {
      delete n.picture;
      delete n.image_url;
    }
    delete n.caption;
  };
  prune(clone.link_data);
  prune(clone.video_data);
  return clone;
}

/**
 * Aplica variações de texto novas a uma cópia profunda do asset_feed_spec.
 * Pura/testável. Substitui titles/bodies/descriptions; preserva imagens, vídeos,
 * formatos, CTAs, link_urls e tudo o resto. Exige ≥1 título e ≥1 texto.
 */
export function applyTextsToAssetFeedSpec(
  afs: Record<string, unknown>,
  texts: DynamicTexts,
): { ok: true; spec: Record<string, unknown> } | { ok: false; reason: string } {
  if (!afs || typeof afs !== 'object') return { ok: false, reason: NO_SPEC_REASON };
  const titles = texts.titles.map((t) => t.trim()).filter(Boolean);
  const bodies = texts.bodies.map((t) => t.trim()).filter(Boolean);
  const descriptions = texts.descriptions.map((t) => t.trim()).filter(Boolean);
  if (titles.length === 0 || bodies.length === 0) {
    return { ok: false, reason: 'É preciso pelo menos um título e um texto.' };
  }
  const clone = JSON.parse(JSON.stringify(afs)) as Record<string, unknown>;
  clone.titles = titles.map((text) => ({ text }));
  clone.bodies = bodies.map((text) => ({ text }));
  if (descriptions.length > 0) clone.descriptions = descriptions.map((text) => ({ text }));
  else delete clone.descriptions;
  return { ok: true, spec: clone };
}

/**
 * Limpa um asset_feed_spec lido da Graph API para criar um criativo novo.
 * Pura/testável. Remove URLs eco nas imagens/vídeos quando há hash/id, e campos
 * read-only que o endpoint de criação rejeita.
 */
export function sanitizeAssetFeedSpecForCreate(afs: Record<string, unknown>): Record<string, unknown> {
  const clone = JSON.parse(JSON.stringify(afs)) as Record<string, unknown>;
  const images = clone.images;
  if (Array.isArray(images)) {
    for (const img of images) {
      if (img && typeof img === 'object') {
        const n = img as Record<string, unknown>;
        if (n.hash) { delete n.url; delete n.image_crops; }
      }
    }
  }
  const videos = clone.videos;
  if (Array.isArray(videos)) {
    for (const v of videos) {
      if (v && typeof v === 'object') {
        const n = v as Record<string, unknown>;
        if (n.video_id) delete n.url;
      }
    }
  }
  return clone;
}

/**
 * Edita o texto do anúncio: cria um criativo novo (clonando o spec actual com a
 * copy nova) e aponta o anúncio a esse criativo. Devolve o id do criativo novo.
 * Trata criativo simples (object_story_spec) e dinâmico (asset_feed_spec).
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
  if (full.kind !== 'story' || !full.story_spec) {
    throw new Error(full.reason ?? NO_SPEC_REASON);
  }
  const built = applyCopyToStorySpec(full.story_spec, copy);
  if (!built.ok) throw new Error(built.reason);
  const cleanSpec = sanitizeStorySpecForCreate(built.spec);

  const created = await graphPostJson(`${adAccountId}/adcreatives`, token, {
    name: 'Texto editado via Foco Imo CRM',
    object_story_spec: JSON.stringify(cleanSpec),
  });
  const newId = (created.id as string) || '';
  if (!newId) throw new Error('A Meta não devolveu o criativo novo.');

  await graphPost(adId, token, { creative: JSON.stringify({ creative_id: newId }) });
  return { creative_id: newId };
}

/**
 * Edita os textos de um criativo DINÂMICO (asset_feed_spec): cria um criativo
 * novo com as variações novas e aponta o anúncio a ele. Mantém imagem/vídeo,
 * público e CTA. `adAccountId` no formato `act_<id>`. Lança Error PT em falha.
 */
export async function updateAdDynamicTexts(
  adId: string,
  adAccountId: string | null,
  token: string,
  texts: DynamicTexts,
): Promise<{ creative_id: string }> {
  if (!adAccountId) throw new Error('Conta de anúncios não seleccionada.');
  const full = await getAdCreativeFull(adId, token);
  if (full.kind !== 'dynamic' || !full.asset_feed_spec) {
    throw new Error(full.reason ?? 'Este anúncio não é um criativo dinâmico editável.');
  }
  const built = applyTextsToAssetFeedSpec(full.asset_feed_spec, texts);
  if (!built.ok) throw new Error(built.reason);
  const cleanAfs = sanitizeAssetFeedSpecForCreate(built.spec);

  const fields: Record<string, string> = {
    name: 'Textos editados via Foco Imo CRM',
    asset_feed_spec: JSON.stringify(cleanAfs),
  };
  // Os dinâmicos têm também um object_story_spec (página/link) — é preciso para
  // criar o criativo. Enviamo-lo saneado, a par do asset_feed_spec.
  if (full.story_spec) {
    fields.object_story_spec = JSON.stringify(sanitizeStorySpecForCreate(full.story_spec));
  }

  const created = await graphPostJson(`${adAccountId}/adcreatives`, token, fields);
  const newId = (created.id as string) || '';
  if (!newId) throw new Error('A Meta não devolveu o criativo novo.');

  await graphPost(adId, token, { creative: JSON.stringify({ creative_id: newId }) });
  return { creative_id: newId };
}

// ----------------------------------------------------------------------------
// MA-EDIT Tier 2 — editar a imagem/vídeo do anúncio.
// Tal como a copy, a media troca-se criando um criativo novo com o hash/id da
// media nova e apontando o anúncio a ele. Dois passos: (1) enviar o ficheiro à
// Meta (adimages devolve hash; advideos devolve id) — feito pela rota dedicada;
// (2) trocar a media no spec + criar criativo + swap (aqui). As transformações
// de spec são puras (testáveis) e preservam textos, público, link e CTA.
// ----------------------------------------------------------------------------

/** Mete a imagem nova (hash) num object_story_spec de imagem. Pura/testável. */
export function applyImageToStorySpec(
  spec: Record<string, unknown>,
  imageHash: string,
): { ok: true; spec: Record<string, unknown> } | { ok: false; reason: string } {
  if (!spec || typeof spec !== 'object') return { ok: false, reason: NO_SPEC_REASON };
  const clone = JSON.parse(JSON.stringify(spec)) as Record<string, unknown>;
  const link = clone.link_data as Record<string, unknown> | undefined;
  if (link && typeof link === 'object') {
    link.image_hash = imageHash;
    delete link.picture;
    delete link.image_url;
    return { ok: true, spec: clone };
  }
  return { ok: false, reason: 'Este anúncio é de vídeo — escolha um vídeo para o substituir.' };
}

/** Mete o vídeo novo (id) num object_story_spec de vídeo. Pura/testável. */
export function applyVideoToStorySpec(
  spec: Record<string, unknown>,
  videoId: string,
): { ok: true; spec: Record<string, unknown> } | { ok: false; reason: string } {
  if (!spec || typeof spec !== 'object') return { ok: false, reason: NO_SPEC_REASON };
  const clone = JSON.parse(JSON.stringify(spec)) as Record<string, unknown>;
  const video = clone.video_data as Record<string, unknown> | undefined;
  if (video && typeof video === 'object') {
    video.video_id = videoId;
    return { ok: true, spec: clone };
  }
  return { ok: false, reason: 'Este anúncio é de imagem — escolha uma imagem para a substituir.' };
}

/**
 * Mete a imagem nova (hash) num asset_feed_spec (criativo dinâmico). Pura.
 * Substitui a lista de imagens por uma só (a nova), remove vídeos e fixa o
 * formato em imagem. Preserva títulos, textos, descrições, link e CTA.
 */
export function applyImageToAssetFeedSpec(
  afs: Record<string, unknown>,
  imageHash: string,
): { ok: true; spec: Record<string, unknown> } | { ok: false; reason: string } {
  if (!afs || typeof afs !== 'object') return { ok: false, reason: NO_SPEC_REASON };
  const clone = JSON.parse(JSON.stringify(afs)) as Record<string, unknown>;
  clone.images = [{ hash: imageHash }];
  delete clone.videos;
  if (Array.isArray(clone.ad_formats)) clone.ad_formats = ['SINGLE_IMAGE'];
  return { ok: true, spec: clone };
}

/**
 * Mete o vídeo novo (id) num asset_feed_spec (criativo dinâmico). Pura.
 * Substitui a lista de vídeos por um só (o novo), remove imagens e fixa o
 * formato em vídeo. Preserva títulos, textos, descrições, link e CTA.
 */
export function applyVideoToAssetFeedSpec(
  afs: Record<string, unknown>,
  videoId: string,
): { ok: true; spec: Record<string, unknown> } | { ok: false; reason: string } {
  if (!afs || typeof afs !== 'object') return { ok: false, reason: NO_SPEC_REASON };
  const clone = JSON.parse(JSON.stringify(afs)) as Record<string, unknown>;
  clone.videos = [{ video_id: videoId }];
  delete clone.images;
  if (Array.isArray(clone.ad_formats)) clone.ad_formats = ['SINGLE_VIDEO'];
  return { ok: true, spec: clone };
}

/**
 * Envia uma imagem para a biblioteca da conta (devolve o hash + url). Usa
 * multipart (FormData) — robusto para binário. `adAccountId` = `act_<id>`.
 * A Meta devolve { images: { <nome>: { hash, url } } } — lemos o primeiro.
 */
export async function uploadAdImage(
  adAccountId: string,
  token: string,
  bytes: ArrayBuffer,
  filename: string,
  mime: string,
): Promise<{ hash: string; url: string | null }> {
  const form = new FormData();
  form.append('access_token', token);
  form.append('filename', new Blob([bytes], { type: mime || 'image/jpeg' }), filename || 'imagem');
  const res = await fetch(`${META_GRAPH_BASE}/${adAccountId}/adimages`, {
    method: 'POST',
    headers: { 'User-Agent': 'FocoImoCRM/1.0' },
    body: form,
  });
  let json: Record<string, unknown> = {};
  try { json = (await res.json()) as Record<string, unknown>; } catch { /* corpo não-JSON */ }
  if (!res.ok) throw new Error(metaErrorMessage(json, res.status));
  const images = (json.images ?? {}) as Record<string, { hash?: string; url?: string }>;
  const first = Object.values(images)[0];
  if (!first?.hash) throw new Error('A Meta não devolveu o identificador da imagem.');
  return { hash: first.hash, url: first.url ?? null };
}

/**
 * Envia um vídeo para a biblioteca da conta (devolve o id). Usa multipart.
 * O vídeo é processado pela Meta uns segundos antes de poder ser usado — a UI
 * avisa. `adAccountId` = `act_<id>`.
 */
export async function uploadAdVideo(
  adAccountId: string,
  token: string,
  bytes: ArrayBuffer,
  filename: string,
  mime: string,
): Promise<{ id: string }> {
  const form = new FormData();
  form.append('access_token', token);
  form.append('source', new Blob([bytes], { type: mime || 'video/mp4' }), filename || 'video');
  const res = await fetch(`${META_GRAPH_BASE}/${adAccountId}/advideos`, {
    method: 'POST',
    headers: { 'User-Agent': 'FocoImoCRM/1.0' },
    body: form,
  });
  let json: Record<string, unknown> = {};
  try { json = (await res.json()) as Record<string, unknown>; } catch { /* corpo não-JSON */ }
  if (!res.ok) throw new Error(metaErrorMessage(json, res.status));
  const id = (json.id as string) || '';
  if (!id) throw new Error('A Meta não devolveu o identificador do vídeo.');
  return { id };
}

/**
 * Troca a imagem/vídeo do anúncio: cria um criativo novo (clonando o spec actual
 * com a media nova) e aponta o anúncio a ele. Trata criativo simples
 * (object_story_spec) e dinâmico (asset_feed_spec). Passa-se OU imageHash OU
 * videoId. `adAccountId` = `act_<id>`. Lança Error PT em falha.
 */
export async function updateAdMedia(
  adId: string,
  adAccountId: string | null,
  token: string,
  media: { imageHash?: string; videoId?: string },
): Promise<{ creative_id: string }> {
  if (!adAccountId) throw new Error('Conta de anúncios não seleccionada.');
  if (!media.imageHash && !media.videoId) throw new Error('Falta a imagem ou o vídeo.');
  const full = await getAdCreativeFull(adId, token);

  const fields: Record<string, string> = { name: 'Media editada via Foco Imo CRM' };

  if (full.kind === 'dynamic' && full.asset_feed_spec) {
    const built = media.imageHash
      ? applyImageToAssetFeedSpec(full.asset_feed_spec, media.imageHash)
      : applyVideoToAssetFeedSpec(full.asset_feed_spec, media.videoId as string);
    if (!built.ok) throw new Error(built.reason);
    fields.asset_feed_spec = JSON.stringify(sanitizeAssetFeedSpecForCreate(built.spec));
    if (full.story_spec) {
      fields.object_story_spec = JSON.stringify(sanitizeStorySpecForCreate(full.story_spec));
    }
  } else if (full.kind === 'story' && full.story_spec) {
    const built = media.imageHash
      ? applyImageToStorySpec(full.story_spec, media.imageHash)
      : applyVideoToStorySpec(full.story_spec, media.videoId as string);
    if (!built.ok) throw new Error(built.reason);
    fields.object_story_spec = JSON.stringify(sanitizeStorySpecForCreate(built.spec));
  } else {
    throw new Error(full.reason ?? NO_SPEC_REASON);
  }

  let created: Record<string, unknown>;
  try {
    created = await graphPostJson(`${adAccountId}/adcreatives`, token, fields);
  } catch (e) {
    // A criação de criativo de VÍDEO pela API exige uma capacidade da app Meta
    // que pode não estar activa (erro "(#3) ... capability"); a imagem não.
    // Transforma o erro cru numa explicação PT accionável (não é bug do CRM).
    if (media.videoId && e instanceof Error && /capability|\(#3\)/i.test(e.message)) {
      throw new Error(
        'A Meta recusou criar o anúncio de vídeo novo: esta app ainda não tem a capacidade de vídeo da Marketing API (a edição de imagem funciona). Por agora, troque o vídeo no Gestor de Anúncios da Meta; a edição de imagem e os textos fazem-se aqui.',
      );
    }
    throw e;
  }
  const newId = (created.id as string) || '';
  if (!newId) throw new Error('A Meta não devolveu o criativo novo.');

  await graphPost(adId, token, { creative: JSON.stringify({ creative_id: newId }) });
  return { creative_id: newId };
}

// ----------------------------------------------------------------------------
// MA-DUPLICATE (Tier 3) — duplicar um anúncio para testar variantes (A/B) sem
// tocar no original. Usa o endpoint nativo /copies da Meta (copia o anúncio e o
// seu criativo). A cópia entra EM PAUSA. "Desfazer" apaga a cópia recém-criada.
// ----------------------------------------------------------------------------

/**
 * Duplica o anúncio para testar (A/B). Copia o CONJUNTO do anúncio (que traz o
 * anúncio dentro) para um conjunto novo EM PAUSA — a Meta não deixa ter dois
 * anúncios no mesmo conjunto de criativo dinâmico, e testar em conjunto separado
 * é a prática recomendada. Devolve o id do conjunto novo (para desfazer).
 */
export async function duplicateAd(adId: string, token: string): Promise<{ new_adset_id: string }> {
  const live = await getAdLiveState(adId, token);
  if (!live.adset_id) throw new Error('Não foi possível identificar o conjunto do anúncio.');
  const json = await graphPostJson(`${live.adset_id}/copies`, token, {
    status_option: 'PAUSED',
    rename_options: JSON.stringify({ rename_strategy: 'ONLY_TOP_LEVEL_RENAME', rename_suffix: ' (cópia CRM)' }),
  });
  const newAdset =
    (json.copied_adset_id as string) || (json.id as string) || '';
  if (!newAdset) throw new Error('A Meta não devolveu o conjunto duplicado.');
  return { new_adset_id: newAdset };
}

/** Lê o id da conta de anúncios de um anúncio (validação de posse). `act_<id>`. */
export async function getAdAccountId(adId: string, token: string): Promise<string | null> {
  const json = await graphGet(`${adId}?fields=account_id`, token);
  const acc = json.account_id as string | undefined;
  return acc ? `act_${acc}` : null;
}

/** Apaga um anúncio (usado para desfazer uma duplicação). */
export async function deleteAd(adId: string, token: string): Promise<void> {
  await graphDelete(adId, token);
}

/** Pausa ou reactiva o anúncio (nível anúncio). status: 'ACTIVE' | 'PAUSED'. */
export async function setAdStatus(adId: string, token: string, status: 'ACTIVE' | 'PAUSED'): Promise<void> {
  await graphPost(adId, token, { status });
}

// ----------------------------------------------------------------------------
// MA-CREATE (Tier 4) — criar campanha/conjunto/anúncio de raiz. Começamos pela
// campanha (objecto de topo). `special_ad_categories` é obrigatório pela Meta
// (vazio = sem categoria especial; imobiliário em alguns países exige HOUSING —
// a confirmar para PT). Cria-se sempre EM PAUSA. `adAccountId` = `act_<id>`.
// ----------------------------------------------------------------------------
export async function createCampaign(
  adAccountId: string | null,
  token: string,
  opts: { name: string; objective: string; status?: 'PAUSED' | 'ACTIVE'; specialAdCategories?: string[]; adsetBudgetSharing?: boolean },
): Promise<{ id: string }> {
  if (!adAccountId) throw new Error('Conta de anúncios não seleccionada.');
  const created = await graphPostJson(`${adAccountId}/campaigns`, token, {
    name: opts.name,
    objective: opts.objective,
    status: opts.status ?? 'PAUSED',
    special_ad_categories: JSON.stringify(opts.specialAdCategories ?? []),
    // Sem orçamento de campanha (CBO): a Meta exige declarar a partilha de 20%
    // entre conjuntos. Por decisão do João = nunca → false.
    is_adset_budget_sharing_enabled: String(opts.adsetBudgetSharing ?? false),
  });
  const id = (created.id as string) || '';
  if (!id) throw new Error('A Meta não devolveu a campanha criada.');
  return { id };
}

/** Apaga uma campanha (usado para limpar uma campanha de teste). */
export async function deleteCampaign(campaignId: string, token: string): Promise<void> {
  await graphDelete(campaignId, token);
}

// MA-CREATE Fase 2 — criar o conjunto de anúncios (adset).
// ----------------------------------------------------------------------------
// Onde converter (decisão do João): Formulário instantâneo (default, caminho
// VERDE verificado: LEAD_GENERATION + promoted_object{page_id}, sem
// destination_type), Site (LANDING_PAGE_VIEWS no site) ou WhatsApp (mensagens).
// Orçamento mínimo desta conta ~2,59€/dia (subcódigo 1885272); a UI valida e a
// Meta é a autoridade final. Geo por cidade+raio (key da pesquisa adgeolocation)
// ou, em falta, país (Portugal). Cria SEMPRE em pausa.

/** Orçamento diário mínimo do conjunto nesta conta (cêntimos, ~2,59€). */
export const MIN_DAILY_BUDGET_CENTS = 259;

export type AdSetConversion = 'form' | 'site' | 'whatsapp';

export interface GeoCity {
  key: string;
  /** Raio em quilómetros (Meta aceita ~1–80 km para cidades). */
  radius: number;
}

/**
 * Mapeia a "localização da conversão" escolhida pelo João para os parâmetros
 * do conjunto. Formulário fica IDÊNTICO ao probe verde (sem destination_type)
 * para não partir o que está validado.
 */
export function conversionToAdSetParams(conversion: AdSetConversion): {
  optimizationGoal: string;
  destinationType?: string;
  usePagePromotedObject: boolean;
} {
  switch (conversion) {
    case 'site':
      return { optimizationGoal: 'LANDING_PAGE_VIEWS', destinationType: 'WEBSITE', usePagePromotedObject: false };
    case 'whatsapp':
      return { optimizationGoal: 'CONVERSATIONS', destinationType: 'WHATSAPP', usePagePromotedObject: true };
    case 'form':
    default:
      return { optimizationGoal: 'LEAD_GENERATION', usePagePromotedObject: true };
  }
}

/** Constrói o targeting do conjunto: cidade+raio se houver, senão país. */
export function buildAdSetTargeting(opts: {
  geoCities?: GeoCity[];
  geoCountries?: string[];
  advantageAudience?: boolean;
}): Record<string, unknown> {
  const t: Record<string, unknown> = {};
  if (opts.geoCities && opts.geoCities.length > 0) {
    t.geo_locations = {
      cities: opts.geoCities.map((c) => ({ key: c.key, radius: c.radius, distance_unit: 'kilometer' })),
    };
  } else {
    t.geo_locations = { countries: opts.geoCountries ?? ['PT'] };
  }
  // Público Advantage+ (default do João): a Meta expande além do segmento base.
  if (opts.advantageAudience) {
    t.targeting_automation = { advantage_audience: 1 };
  }
  return t;
}

/** Converte "5,00" / "5.00" / "5" (euros) em cêntimos; null se inválido. */
export function parseEurosToCents(input: string): number | null {
  const cleaned = (input ?? '').replace(/[€\s]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const euros = parseFloat(cleaned);
  if (!Number.isFinite(euros) || euros <= 0) return null;
  return Math.round(euros * 100);
}

export async function createAdSet(
  adAccountId: string | null,
  token: string,
  opts: {
    name: string;
    campaignId: string;
    dailyBudgetCents: number;
    pageId: string | null;
    conversion?: AdSetConversion;
    geoCities?: GeoCity[];
    geoCountries?: string[];
    advantageAudience?: boolean;
    status?: 'PAUSED' | 'ACTIVE';
  },
): Promise<{ id: string }> {
  if (!adAccountId) throw new Error('Conta de anúncios não seleccionada.');
  const conv = conversionToAdSetParams(opts.conversion ?? 'form');
  if (conv.usePagePromotedObject && !opts.pageId) throw new Error('Página não seleccionada.');
  const targeting = buildAdSetTargeting({
    geoCities: opts.geoCities,
    geoCountries: opts.geoCountries,
    advantageAudience: opts.advantageAudience,
  });
  const fields: Record<string, string> = {
    name: opts.name,
    campaign_id: opts.campaignId,
    daily_budget: String(opts.dailyBudgetCents),
    billing_event: 'IMPRESSIONS',
    optimization_goal: conv.optimizationGoal,
    // Sem CBO nem limite de licitação → "maior volume" (default do João).
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
    targeting: JSON.stringify(targeting),
    status: opts.status ?? 'PAUSED',
  };
  if (conv.destinationType) fields.destination_type = conv.destinationType;
  if (conv.usePagePromotedObject && opts.pageId) {
    fields.promoted_object = JSON.stringify({ page_id: opts.pageId });
  }
  const created = await graphPostJson(`${adAccountId}/adsets`, token, fields);
  const id = (created.id as string) || '';
  if (!id) throw new Error('A Meta não devolveu o conjunto criado.');
  return { id };
}

// ---- Pesquisa de localização (cidade) e estimativa de público --------------

export interface GeoSearchResult {
  key: string;
  name: string;
  type: string;
  region?: string;
  countryName?: string;
  countryCode?: string;
}

/** Lê os resultados da pesquisa adgeolocation da Meta. */
export function parseGeoSearch(json: Record<string, unknown>): GeoSearchResult[] {
  const data = Array.isArray(json.data) ? json.data : [];
  return data
    .map((d) => {
      const r = (d ?? {}) as Record<string, unknown>;
      return {
        key: String(r.key ?? ''),
        name: String(r.name ?? ''),
        type: String(r.type ?? ''),
        region: r.region ? String(r.region) : undefined,
        countryName: r.country_name ? String(r.country_name) : undefined,
        countryCode: r.country_code ? String(r.country_code) : undefined,
      };
    })
    .filter((r) => r.key && r.name);
}

/** Pesquisa cidades/localidades por texto (para o selector de localização). */
export async function searchAdGeoLocations(token: string, q: string): Promise<GeoSearchResult[]> {
  const params = new URLSearchParams({
    type: 'adgeolocation',
    location_types: JSON.stringify(['city']),
    q,
    limit: '8',
  });
  const json = await graphGet(`search?${params.toString()}`, token);
  return parseGeoSearch(json);
}

/** Lê os limites de público do delivery_estimate (vários formatos da Meta). */
export function parseReachEstimate(json: Record<string, unknown>): { lower: number; upper: number } | null {
  const raw = Array.isArray(json.data) ? json.data[0] : json.data;
  const data = (raw ?? json) as Record<string, unknown>;
  if (!data) return null;
  const lower = Number(
    data.estimate_mau_lower_bound ?? data.users_lower_bound ?? data.estimate_dau ?? data.users,
  );
  const upper = Number(
    data.estimate_mau_upper_bound ?? data.users_upper_bound ?? data.estimate_mau ?? lower,
  );
  if (!Number.isFinite(lower)) return null;
  return { lower, upper: Number.isFinite(upper) ? upper : lower };
}

/** Estimativa de público atingível para um targeting (delivery_estimate). */
export async function estimateReach(
  adAccountId: string | null,
  token: string,
  targetingSpec: Record<string, unknown>,
  optimizationGoal = 'LEAD_GENERATION',
): Promise<{ lower: number; upper: number } | null> {
  if (!adAccountId) return null;
  const params = new URLSearchParams({
    optimization_goal: optimizationGoal,
    targeting_spec: JSON.stringify(targetingSpec),
  });
  const json = await graphGet(`${adAccountId}/delivery_estimate?${params.toString()}`, token);
  return parseReachEstimate(json);
}

// MA-CREATE Fase 3 — criar o anúncio (criativo + anúncio).
// ----------------------------------------------------------------------------
// O anúncio é uma media (imagem) + copy + destino + CTA. Cria-se em dois passos:
// (1) criativo (object_story_spec.link_data com page_id, imagem, textos, link e
// call_to_action) via adcreatives; (2) anúncio que liga o conjunto ao criativo,
// EM PAUSA. Reusa `uploadAdImage` do Tier 2 para a imagem. De-risco confirmado
// VERDE na conta real (anúncio de imagem não tem o portão `(#3)` do vídeo).
// Destino: Site (CTA aponta ao link) ou Formulário (CTA SIGN_UP + lead_gen_form_id).

export interface AdCreativeInput {
  pageId: string;
  imageHash: string;
  /** Texto principal (link_data.message). */
  message: string;
  /** Título (link_data.name). */
  title?: string;
  /** Descrição (link_data.description). */
  description?: string;
  /** URL do site (destino Site); no destino Formulário usa-se a Página. */
  link?: string;
  /** Tipo de apelo à acção da Meta (ex.: LEARN_MORE, SIGN_UP, MESSAGE_PAGE). */
  ctaType: string;
  /** Id do formulário de leads (destino Formulário). */
  leadGenFormId?: string;
}

/** Constrói o object_story_spec de um criativo de imagem. Puro/testável. */
export function buildAdCreativeStorySpec(input: AdCreativeInput): Record<string, unknown> {
  const link = input.link || `https://facebook.com/${input.pageId}`;
  const linkData: Record<string, unknown> = {
    image_hash: input.imageHash,
    message: input.message,
    link,
  };
  if (input.title) linkData.name = input.title;
  if (input.description) linkData.description = input.description;
  const value: Record<string, unknown> = input.leadGenFormId
    ? { lead_gen_form_id: input.leadGenFormId }
    : { link };
  linkData.call_to_action = { type: input.ctaType, value };
  return { page_id: input.pageId, link_data: linkData };
}

/** Cria um criativo (object_story_spec) na conta. `adAccountId` = `act_<id>`. */
export async function createAdCreative(
  adAccountId: string | null,
  token: string,
  opts: { name: string; storySpec: Record<string, unknown> },
): Promise<{ id: string }> {
  if (!adAccountId) throw new Error('Conta de anúncios não seleccionada.');
  const created = await graphPostJson(`${adAccountId}/adcreatives`, token, {
    name: opts.name,
    object_story_spec: JSON.stringify(opts.storySpec),
  });
  const id = (created.id as string) || '';
  if (!id) throw new Error('A Meta não devolveu o criativo criado.');
  return { id };
}

/** Cria o anúncio que liga o conjunto ao criativo. Cria EM PAUSA. */
export async function createAd(
  adAccountId: string | null,
  token: string,
  opts: { name: string; adsetId: string; creativeId: string; status?: 'PAUSED' | 'ACTIVE' },
): Promise<{ id: string }> {
  if (!adAccountId) throw new Error('Conta de anúncios não seleccionada.');
  const created = await graphPostJson(`${adAccountId}/ads`, token, {
    name: opts.name,
    adset_id: opts.adsetId,
    creative: JSON.stringify({ creative_id: opts.creativeId }),
    status: opts.status ?? 'PAUSED',
  });
  const id = (created.id as string) || '';
  if (!id) throw new Error('A Meta não devolveu o anúncio criado.');
  return { id };
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
