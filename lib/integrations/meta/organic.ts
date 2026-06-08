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
};

export interface OrganicSummary {
  kpis: { posts: number; interactions: number; avg: number };
  top: OrganicPost[];
  timeline: Array<{ label: string; value: number }>;
  by_type: Array<{ type: string; label: string; value: number }>;
  reach_available: false;
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
    top, timeline, by_type, reach_available: false,
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
