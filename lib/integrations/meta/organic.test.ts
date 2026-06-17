import { describe, it, expect } from 'vitest';
import { normalizePost, normalizeIgMedia, summarizeOrganic, parseIgReach, clampReachWindow, type OrganicPost } from './organic';

describe('normalizePost', () => {
  it('soma interações e deriva tipo do anexo', () => {
    const p = normalizePost({
      id: '1', message: ' Olá ', created_time: '2026-05-12T10:00:00+0000',
      permalink_url: 'https://fb/1', full_picture: 'https://img/1',
      attachments: { data: [{ media_type: 'photo' }] },
      reactions: { summary: { total_count: 214 } },
      comments: { summary: { total_count: 38 } },
      shares: { count: 22 },
    });
    expect(p.message).toBe('Olá');
    expect(p.media_type).toBe('photo');
    expect(p.reactions).toBe(214);
    expect(p.interactions).toBe(214 + 38 + 22);
  });

  it('sem métricas → zeros, tipo status', () => {
    const p = normalizePost({ id: '2', created_time: '2026-05-01T00:00:00+0000' });
    expect(p.interactions).toBe(0);
    expect(p.media_type).toBe('status');
    expect(p.message).toBe('');
  });
});

describe('normalizeIgMedia', () => {
  it('mapeia gostos+comentários (sem partilhas) e tipo IMAGE→photo', () => {
    const p = normalizeIgMedia({
      id: 'ig1', caption: ' Casa nova ', media_type: 'IMAGE', media_product_type: 'FEED',
      timestamp: '2026-06-10T09:00:00+0000', permalink: 'https://instagram.com/p/abc',
      thumbnail_url: null as unknown as string, media_url: 'https://cdn/ig1.jpg',
      like_count: 120, comments_count: 8,
    });
    expect(p.message).toBe('Casa nova');
    expect(p.media_type).toBe('photo');
    expect(p.reactions).toBe(120);
    expect(p.comments).toBe(8);
    expect(p.shares).toBe(0); // IG orgânico não tem partilhas na API
    expect(p.interactions).toBe(128);
    expect(p.picture).toBe('https://cdn/ig1.jpg'); // cai para media_url quando sem thumbnail
  });

  it('REELS→reel, CAROUSEL_ALBUM→carousel, sem métricas→zeros', () => {
    expect(normalizeIgMedia({ id: 'r', media_type: 'VIDEO', media_product_type: 'REELS', timestamp: '2026-06-01T00:00:00+0000' }).media_type).toBe('reel');
    const c = normalizeIgMedia({ id: 'c', media_type: 'CAROUSEL_ALBUM', timestamp: '2026-06-01T00:00:00+0000' });
    expect(c.media_type).toBe('carousel');
    expect(c.interactions).toBe(0);
    expect(c.message).toBe('');
  });
});

describe('summarizeOrganic', () => {
  const mk = (id: string, date: string, r: number, c: number, s: number, type = 'photo'): OrganicPost => ({
    id, message: `post ${id}`, created_time: date, permalink: null, picture: null,
    media_type: type, reactions: r, comments: c, shares: s, interactions: r + c + s,
  });

  it('KPIs, top ordenado, por tipo', () => {
    const posts = [
      mk('a', '2026-05-12T10:00:00Z', 200, 30, 20, 'photo'),
      mk('b', '2026-04-28T10:00:00Z', 100, 10, 5, 'video'),
      mk('c', '2026-05-02T10:00:00Z', 50, 5, 5, 'photo'),
    ];
    const s = summarizeOrganic(posts);
    expect(s.kpis.posts).toBe(3);
    expect(s.kpis.interactions).toBe(250 + 115 + 60);
    expect(s.kpis.avg).toBe(Math.round((250 + 115 + 60) / 3));
    expect(s.top[0].id).toBe('a'); // mais interacção primeiro
    expect(s.reach_available).toBe(false);
    // por tipo: photo (250+60=310) > video (115)
    expect(s.by_type[0]).toMatchObject({ type: 'photo', label: 'Fotos', value: 310 });
    expect(s.by_type[1]).toMatchObject({ type: 'video', value: 115 });
  });

  it('lista vazia → tudo a zero, sem rebentar', () => {
    const s = summarizeOrganic([]);
    expect(s.kpis).toEqual({ posts: 0, interactions: 0, avg: 0 });
    expect(s.top).toEqual([]);
    expect(s.timeline).toEqual([]);
    expect(s.by_type).toEqual([]);
  });

  it('timeline agrupa por semana e ordena', () => {
    const posts = [mk('a', '2026-05-12T10:00:00Z', 10, 0, 0), mk('b', '2026-04-02T10:00:00Z', 5, 0, 0)];
    const s = summarizeOrganic(posts);
    expect(s.timeline.length).toBe(2);
    expect(s.timeline[0].label < s.timeline[1].label).toBe(true); // Abril antes de Maio
  });
});

describe('parseIgReach (ORG-IG Fatia 2)', () => {
  it('lê o total_value (de-duplicado) do reach', () => {
    expect(parseIgReach({ data: [{ name: 'reach', total_value: { value: 1234 } }] })).toBe(1234);
  });

  it('só veio values[] diário (sem total_value) → null (NUNCA somar = sobre-contar)', () => {
    expect(parseIgReach({ data: [{ name: 'reach', values: [{ value: 100 }, { value: 200 }] }] })).toBeNull();
  });

  it('resposta vazia ou erro → null', () => {
    expect(parseIgReach({})).toBeNull();
    expect(parseIgReach({ data: [] })).toBeNull();
    expect(parseIgReach({ error: { message: 'boom' } })).toBeNull();
  });
});

describe('clampReachWindow (≤30 dias)', () => {
  const now = '2026-06-17T12:00:00Z';

  it('janela dentro de 30d fica intacta (não clampa)', () => {
    const w = clampReachWindow('2026-05-25T00:00:00Z', '2026-06-17T23:59:59Z', now);
    expect(w.clamped).toBe(false);
    expect(w.since.startsWith('2026-05-25')).toBe(true);
  });

  it('janela > 30d é reduzida aos últimos 30d (until fixo, since recua)', () => {
    const w = clampReachWindow('2026-01-01T00:00:00Z', '2026-06-17T23:59:59Z', now);
    expect(w.clamped).toBe(true);
    expect(w.days).toBe(30);
    // since = until - 30d ≈ 2026-05-18
    expect(w.since.startsWith('2026-05-18')).toBe(true);
  });

  it('sem datas → últimos 30d até agora', () => {
    const w = clampReachWindow(null, null, now);
    expect(w.clamped).toBe(false);
    expect(w.days).toBe(30);
    expect(w.until.startsWith('2026-06-17')).toBe(true);
  });
});
