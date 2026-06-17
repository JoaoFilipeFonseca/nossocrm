// ============================================================================
// organic.ts — Orgânico da Página (MKT-ORGANIC-INSIGHTS).
// ============================================================================
// Busca os posts da Página (Graph API) com reações/comentários/partilhas e
// agrega: KPIs, melhores posts, interacção ao longo do tempo e por tipo de
// conteúdo. v1 = leitura ao vivo (sem tabela/cron): reusa pages_read_engagement.
// O ALCANCE/impressões NÃO vem aqui (precisa de read_insights → re-autorização).
// summarizeOrganic é puro (testável); fetchPagePosts faz a rede.
// ============================================================================
import 'server-only';
import { META_GRAPH_BASE } from './config';

export interface OrganicPost {
  id: string;
  message: string;
  created_time: string;
  permalink: string | null;
  picture: string | null;
  media_type: string; // photo | video | link | status | album | ...
  reactions: number;
  comments: number;
  shares: number;
  interactions: number;
}

interface RawPost {
  id: string;
  message?: string;
  story?: string;
  created_time: string;
  permalink_url?: string;
  full_picture?: string;
  attachments?: { data?: Array<{ media_type?: string; type?: string }> };
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  shares?: { count?: number };
}

const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** Normaliza um post cru da Graph num OrganicPost. */
export function normalizePost(r: RawPost): OrganicPost {
  const reactions = num(r.reactions?.summary?.total_count);
  const comments = num(r.comments?.summary?.total_count);
  const shares = num(r.shares?.count);
  const att = r.attachments?.data?.[0];
  return {
    id: r.id,
    message: (r.message ?? r.story ?? '').trim(),
    created_time: r.created_time,
    permalink: r.permalink_url ?? null,
    picture: r.full_picture ?? null,
    media_type: (att?.media_type ?? att?.type ?? 'status').toLowerCase(),
    reactions, comments, shares,
    interactions: reactions + comments + shares,
  };
}

const TYPE_LABEL: Record<string, string> = {
  photo: 'Fotos', video: 'Vídeos', link: 'Ligações', status: 'Texto',
  album: 'Álbuns', share: 'Partilhas', event: 'Eventos', note: 'Notas',
  reel: 'Reels', carousel: 'Carrosséis',
};

export interface OrganicSummary {
  kpis: { posts: number; interactions: number; avg: number };
  top: OrganicPost[];
  timeline: Array<{ label: string; value: number }>;
  by_type: Array<{ type: string; label: string; value: number }>;
  // Alcance no período (ORG-IG Fatia 2). null + reach_available:false enquanto a
  // conta não for religada com read_insights/instagram_manage_insights.
  reach: number | null;
  reach_available: boolean;
}

/** Agrega os posts num resumo para o painel. Puro e determinista. */
export function summarizeOrganic(posts: OrganicPost[]): OrganicSummary {
  const total = posts.reduce((s, p) => s + p.interactions, 0);
  const top = [...posts].sort((a, b) => b.interactions - a.interactions).slice(0, 8);

  // Interacção por semana (ISO yyyy-Www), ordenada por data.
  const buckets = new Map<string, number>();
  for (const p of posts) {
    const d = new Date(p.created_time);
    if (Number.isNaN(d.getTime())) continue;
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.floor((d.getUTCDate() - 1) / 7) * 7 + 1).padStart(2, '0')}`;
    buckets.set(key, (buckets.get(key) ?? 0) + p.interactions);
  }
  const timeline = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }));

  // Por tipo de conteúdo (média de interacções vem do total por tipo).
  const types = new Map<string, number>();
  for (const p of posts) types.set(p.media_type, (types.get(p.media_type) ?? 0) + p.interactions);
  const by_type = [...types.entries()]
    .map(([type, value]) => ({ type, label: TYPE_LABEL[type] ?? type, value }))
    .sort((a, b) => b.value - a.value);

  return {
    kpis: { posts: posts.length, interactions: total, avg: posts.length ? Math.round(total / posts.length) : 0 },
    top, timeline, by_type, reach: null, reach_available: false,
  };
}

/** Busca os posts da Página no intervalo. Lança em erro da Graph. */
export async function fetchPagePosts(
  pageId: string,
  pageToken: string,
  sinceISO: string | null,
  untilISO: string | null,
): Promise<OrganicPost[]> {
  const fields = [
    'message', 'story', 'created_time', 'permalink_url', 'full_picture',
    'attachments{media_type,type}',
    'reactions.summary(true).limit(0)',
    'comments.summary(true).limit(0)',
    'shares',
  ].join(',');
  const params = new URLSearchParams({ fields, limit: '100', access_token: pageToken });
  if (sinceISO) params.set('since', String(Math.floor(new Date(sinceISO).getTime() / 1000)));
  if (untilISO) params.set('until', String(Math.floor(new Date(untilISO).getTime() / 1000)));

  const res = await fetch(`${META_GRAPH_BASE}/${pageId}/posts?${params.toString()}`, {
    headers: { 'User-Agent': 'FocoImoCRM/1.0' },
  });
  const json = (await res.json().catch(() => ({}))) as { data?: RawPost[]; error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Graph ${res.status}`);
  return (json.data ?? []).map(normalizePost);
}

// ============================================================================
// Instagram (ORG-IG, Fatia 1) — posts + interacções (gostos + comentários).
// Reusa instagram_basic (já nos scopes). like_count/comments_count são contagens
// básicas (não "insights"). Alcance/impressões/guardados = Fatia 2 (precisa de
// instagram_manage_insights → re-autorização). Não há "partilhas" na API orgânica
// do IG → shares=0. O token usado é o token da Página ligada à conta IG Business.
// ============================================================================

interface RawIgMedia {
  id: string;
  caption?: string;
  media_type?: string; // IMAGE | VIDEO | CAROUSEL_ALBUM
  media_product_type?: string; // FEED | REELS | ...
  timestamp?: string;
  permalink?: string;
  media_url?: string;
  thumbnail_url?: string;
  like_count?: number;
  comments_count?: number;
}

/** Mapeia o tipo de media do IG para a chave usada em TYPE_LABEL. */
function igMediaType(r: RawIgMedia): string {
  if ((r.media_product_type ?? '').toUpperCase() === 'REELS') return 'reel';
  switch ((r.media_type ?? '').toUpperCase()) {
    case 'VIDEO': return 'video';
    case 'CAROUSEL_ALBUM': return 'carousel';
    case 'IMAGE': return 'photo';
    default: return 'photo';
  }
}

/** Normaliza uma media crua do IG num OrganicPost (mesmo shape do FB). */
export function normalizeIgMedia(r: RawIgMedia): OrganicPost {
  const reactions = num(r.like_count); // gostos
  const comments = num(r.comments_count);
  return {
    id: r.id,
    message: (r.caption ?? '').trim(),
    created_time: r.timestamp ?? '',
    permalink: r.permalink ?? null,
    picture: r.thumbnail_url ?? r.media_url ?? null,
    media_type: igMediaType(r),
    reactions,
    comments,
    shares: 0, // não disponível na API orgânica do IG
    interactions: reactions + comments,
  };
}

/** Resolve o id da conta Instagram Business ligada à Página. null se não houver. */
export async function fetchInstagramAccountId(pageId: string, pageToken: string): Promise<string | null> {
  const params = new URLSearchParams({ fields: 'instagram_business_account', access_token: pageToken });
  const res = await fetch(`${META_GRAPH_BASE}/${pageId}?${params.toString()}`, {
    headers: { 'User-Agent': 'FocoImoCRM/1.0' },
  });
  const json = (await res.json().catch(() => ({}))) as { instagram_business_account?: { id?: string }; error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Graph ${res.status}`);
  return json.instagram_business_account?.id ?? null;
}

/** Busca as publicações do IG no intervalo. Lança em erro da Graph. */
export async function fetchInstagramMedia(
  igUserId: string,
  pageToken: string,
  sinceISO: string | null,
  untilISO: string | null,
): Promise<OrganicPost[]> {
  const fields = [
    'caption', 'media_type', 'media_product_type', 'timestamp', 'permalink',
    'media_url', 'thumbnail_url', 'like_count', 'comments_count',
  ].join(',');
  const params = new URLSearchParams({ fields, limit: '100', access_token: pageToken });
  if (sinceISO) params.set('since', String(Math.floor(new Date(sinceISO).getTime() / 1000)));
  if (untilISO) params.set('until', String(Math.floor(new Date(untilISO).getTime() / 1000)));

  const res = await fetch(`${META_GRAPH_BASE}/${igUserId}/media?${params.toString()}`, {
    headers: { 'User-Agent': 'FocoImoCRM/1.0' },
  });
  const json = (await res.json().catch(() => ({}))) as { data?: RawIgMedia[]; error?: { message?: string } };
  if (!res.ok || json.error) throw new Error(json.error?.message ?? `Graph ${res.status}`);
  return (json.data ?? []).map(normalizeIgMedia);
}

// ============================================================================
// ORG-IG Fatia 2 — ALCANCE do Instagram (reach único do período).
// ----------------------------------------------------------------------------
// A 1.ª tentativa somava o reach DIÁRIO → sobre-contava a mesma pessoa em dias
// diferentes (não é "pessoas alcançadas"). O caminho honesto é pedir o reach
// AGREGADO do período com `metric_type=total_value`, que a Meta devolve já
// de-duplicado em `total_value.value`. A janela do reach de conta é limitada a
// ~30 dias por pedido, por isso clampamos para os últimos 30 dias e sinalizamos.
// ⚠️ O número TEM de ser validado contra a app/Insights da Meta antes de ser
// exposto como KPI (reach_available só passa a true depois dessa validação).
// ============================================================================

const REACH_MAX_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReachWindow {
  since: string; // ISO
  until: string; // ISO
  days: number;
  clamped: boolean; // true se a janela pedida era > 30d e foi reduzida
}

/**
 * Garante uma janela de reach ≤ 30 dias. Se a janela pedida exceder, fixa o
 * `until` e recua o `since` para until-30d (mostra-se só o último mês, com
 * rótulo claro na UI). Puro e determinista (recebe o "agora" por parâmetro).
 */
export function clampReachWindow(
  sinceISO: string | null,
  untilISO: string | null,
  nowISO: string,
): ReachWindow {
  const now = new Date(nowISO).getTime();
  const until = untilISO ? new Date(untilISO).getTime() : now;
  const sinceReq = sinceISO ? new Date(sinceISO).getTime() : until - REACH_MAX_DAYS * DAY_MS;
  const maxSpan = REACH_MAX_DAYS * DAY_MS;
  const span = until - sinceReq;
  const clamped = span > maxSpan;
  const since = clamped ? until - maxSpan : sinceReq;
  return {
    since: new Date(since).toISOString(),
    until: new Date(until).toISOString(),
    days: Math.max(1, Math.round((until - since) / DAY_MS)),
    clamped,
  };
}

interface RawIgInsights {
  data?: Array<{ name?: string; total_value?: { value?: number }; values?: Array<{ value?: number }> }>;
  error?: { message?: string };
}

/**
 * Extrai o reach agregado de uma resposta de insights do IG. Prefere
 * `total_value.value` (de-duplicado); se vier só `values[]` (modo diário),
 * devolve null em vez de somar — somar seria sobre-contar (o erro antigo).
 * Puro e testável.
 */
export function parseIgReach(json: RawIgInsights): number | null {
  const row = (json.data ?? []).find((d) => d.name === 'reach') ?? json.data?.[0];
  if (!row) return null;
  const v = row.total_value?.value;
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/**
 * Busca o ALCANCE único da conta Instagram no período (≤30d, total_value).
 * Devolve o valor + a janela efectiva (para a UI rotular se foi clampada).
 * NÃO lança: em erro devolve reach=null (o resto do orgânico continua a render).
 */
export async function fetchInstagramReach(
  igUserId: string,
  pageToken: string,
  sinceISO: string | null,
  untilISO: string | null,
  nowISO: string,
): Promise<{ reach: number | null; window: ReachWindow }> {
  const w = clampReachWindow(sinceISO, untilISO, nowISO);
  const params = new URLSearchParams({
    metric: 'reach',
    period: 'day',
    metric_type: 'total_value',
    since: String(Math.floor(new Date(w.since).getTime() / 1000)),
    until: String(Math.floor(new Date(w.until).getTime() / 1000)),
    access_token: pageToken,
  });
  try {
    const res = await fetch(`${META_GRAPH_BASE}/${igUserId}/insights?${params.toString()}`, {
      headers: { 'User-Agent': 'FocoImoCRM/1.0' },
    });
    const json = (await res.json().catch(() => ({}))) as RawIgInsights;
    if (!res.ok || json.error) return { reach: null, window: w };
    return { reach: parseIgReach(json), window: w };
  } catch {
    return { reach: null, window: w };
  }
}
