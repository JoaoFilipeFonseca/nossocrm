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

/** Lê o valor de uma série de insights: total_value.value (novo) ou soma de values[].value (period=day). */
function sumDailyInsight(json: unknown): number {
  const d = (json as { data?: Array<{ values?: Array<{ value?: unknown }>; total_value?: { value?: unknown } }> })?.data?.[0];
  if (d?.total_value && d.total_value.value != null) return num(d.total_value.value);
  return (d?.values ?? []).reduce((s, v) => s + num(v?.value), 0);
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
// Alcance no período (ORG-IG Fatia 2) — devolve null se a permissão de insights
// ainda não estiver no token (conta por religar). NUNCA lança: o alcance é
// best-effort e não pode partir o resto do painel.
// ============================================================================

const dayUnix = (iso: string | null, fallbackDaysAgo: number): number =>
  iso ? Math.floor(new Date(iso).getTime() / 1000) : Math.floor((Date.now() - fallbackDaysAgo * 864e5) / 1000);

/** Alcance orgânico da Página de Facebook no período (soma de page_impressions_unique/dia). null se sem permissão. */
export async function fetchPageReach(
  pageId: string,
  pageToken: string,
  sinceISO: string | null,
  untilISO: string | null,
): Promise<number | null> {
  try {
    const params = new URLSearchParams({
      metric: 'page_impressions_unique',
      period: 'day',
      since: String(dayUnix(sinceISO, 90)),
      until: String(dayUnix(untilISO, 0)),
      access_token: pageToken,
    });
    const res = await fetch(`${META_GRAPH_BASE}/${pageId}/insights?${params.toString()}`, {
      headers: { 'User-Agent': 'FocoImoCRM/1.0' },
    });
    const json = (await res.json().catch(() => ({}))) as { data?: unknown; error?: unknown };
    if (!res.ok || (json as { error?: unknown }).error) return null; // sem read_insights → null (mostra "—")
    return sumDailyInsight(json);
  } catch {
    return null;
  }
}

/**
 * Alcance orgânico da conta Instagram no período. null se sem permissão/erro.
 * O IG limita o `reach` com period=day a janelas de 30 dias por pedido → dividimos
 * o intervalo em janelas ≤30 dias e somamos (mesmo critério "soma diária" do FB).
 */
export async function fetchInstagramReach(
  igUserId: string,
  pageToken: string,
  sinceISO: string | null,
  untilISO: string | null,
): Promise<number | null> {
  try {
    const startTs = dayUnix(sinceISO, 90);
    const endTs = dayUnix(untilISO, 0);
    const WINDOW = 30 * 86400; // 30 dias em segundos (limite do IG p/ reach/dia)
    let total = 0;
    let any = false;
    for (let s = startTs; s < endTs; s += WINDOW) {
      const u = Math.min(s + WINDOW, endTs);
      const params = new URLSearchParams({
        metric: 'reach', period: 'day',
        since: String(s), until: String(u),
        access_token: pageToken,
      });
      const res = await fetch(`${META_GRAPH_BASE}/${igUserId}/insights?${params.toString()}`, {
        headers: { 'User-Agent': 'FocoImoCRM/1.0' },
      });
      const json = (await res.json().catch(() => ({}))) as { data?: unknown; error?: unknown };
      if (!res.ok || (json as { error?: unknown }).error) return null; // sem instagram_manage_insights ou erro real
      total += sumDailyInsight(json);
      any = true;
    }
    return any ? total : null;
  } catch {
    return null;
  }
}

/** DEBUG temporário (ORG-IG): devolve o erro cru da Graph para o reach do IG (1.ª janela). */
export async function debugInstagramReach(igUserId: string, pageToken: string, sinceISO: string | null, untilISO: string | null): Promise<unknown> {
  const startTs = dayUnix(sinceISO, 90);
  const endTs = Math.min(startTs + 30 * 86400, dayUnix(untilISO, 0));
  const params = new URLSearchParams({ metric: 'reach', period: 'day', since: String(startTs), until: String(endTs), access_token: pageToken });
  const res = await fetch(`${META_GRAPH_BASE}/${igUserId}/insights?${params.toString()}`, { headers: { 'User-Agent': 'FocoImoCRM/1.0' } });
  const json = await res.json().catch(() => ({}));
  return { status: res.status, body: json };
}
