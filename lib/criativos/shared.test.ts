import { describe, it, expect } from 'vitest';
import {
  CREATIVE_TYPES,
  TYPE_LABELS,
  CREATIVE_ORIGINS,
  ORIGIN_LABELS,
  CREATIVE_STATUSES,
  STATUS_LABELS,
  STATUS_OPTIONS,
  parseUsages,
  uploadKindForMime,
  defaultTypeForMime,
  UPLOAD_ALLOWED_TYPES,
  UPLOAD_MIME_TO_EXT,
} from './shared';

describe('criativos/shared — fonte única', () => {
  it('todos os tipos têm label PT-PT', () => {
    for (const t of CREATIVE_TYPES) {
      expect(TYPE_LABELS[t], `label em falta para ${t}`).toBeTruthy();
    }
  });

  it('todas as origens e estados têm label', () => {
    for (const o of CREATIVE_ORIGINS) expect(ORIGIN_LABELS[o]).toBeTruthy();
    for (const s of CREATIVE_STATUSES) expect(STATUS_LABELS[s]).toBeTruthy();
  });

  it('as opções de estado da UI são um subconjunto dos estados', () => {
    for (const s of STATUS_OPTIONS) expect(CREATIVE_STATUSES).toContain(s);
    expect(STATUS_OPTIONS).toEqual(['draft', 'approved', 'published']);
  });

  it('todos os mimes de upload têm extensão derivada', () => {
    for (const m of UPLOAD_ALLOWED_TYPES) {
      expect(UPLOAD_MIME_TO_EXT[m], `ext em falta para ${m}`).toBeTruthy();
    }
  });
});

describe('parseUsages', () => {
  it('aceita registos válidos e normaliza a data', () => {
    const out = parseUsages([
      { channel: 'Facebook', used_on: '2026-06-09T10:00:00Z', note: ' lançamento ' },
      { channel: 'Instagram', used_on: '2026-06-09' },
    ]);
    expect(out).toEqual([
      { channel: 'Facebook', used_on: '2026-06-09', note: 'lançamento' },
      { channel: 'Instagram', used_on: '2026-06-09' },
    ]);
  });

  it('descarta lixo sem rebentar', () => {
    expect(parseUsages(null)).toEqual([]);
    expect(parseUsages('x')).toEqual([]);
    expect(parseUsages([{ channel: '', used_on: '2026-06-09' }, { channel: 'FB', used_on: 'ontem' }, 42, null])).toEqual([]);
  });
});

describe('upload helpers', () => {
  it('classifica mimes', () => {
    expect(uploadKindForMime('image/png')).toBe('image');
    expect(uploadKindForMime('application/pdf')).toBe('pdf');
    expect(uploadKindForMime('video/mp4')).toBe('video');
    expect(uploadKindForMime('text/html')).toBeNull();
  });

  it('tipo por omissão sensato por mime', () => {
    expect(defaultTypeForMime('application/pdf')).toBe('flyer');
    expect(defaultTypeForMime('video/mp4')).toBe('story');
    expect(defaultTypeForMime('image/jpeg')).toBe('banner');
  });
});
