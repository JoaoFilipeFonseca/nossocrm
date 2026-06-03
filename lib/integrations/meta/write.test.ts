import { describe, it, expect } from 'vitest';
import { extractCopyFromCreative, analyzeCreativeForEdit, applyCopyToStorySpec, sanitizeStorySpecForCreate } from './write';

describe('extractCopyFromCreative', () => {
  it('lê a copy directa do creative', () => {
    const copy = extractCopyFromCreative({ title: 'T', body: 'B', call_to_action_type: 'LEARN_MORE' });
    expect(copy).toEqual({ title: 'T', body: 'B', cta_type: 'LEARN_MORE' });
  });

  it('lê a copy de object_story_spec.link_data', () => {
    const copy = extractCopyFromCreative({
      object_story_spec: { link_data: { name: 'Casa V3', message: 'Marque visita', call_to_action: { type: 'MESSAGE_PAGE' } } },
    });
    expect(copy).toEqual({ title: 'Casa V3', body: 'Marque visita', cta_type: 'MESSAGE_PAGE' });
  });

  it('lê a copy de object_story_spec.video_data', () => {
    const copy = extractCopyFromCreative({
      object_story_spec: { video_data: { title: 'Vídeo', message: 'Veja a moradia', call_to_action: { type: 'CALL_NOW' } } },
    });
    expect(copy).toEqual({ title: 'Vídeo', body: 'Veja a moradia', cta_type: 'CALL_NOW' });
  });

  it('devolve nulls quando não há copy', () => {
    expect(extractCopyFromCreative({})).toEqual({ title: null, body: null, cta_type: null });
  });
});

describe('analyzeCreativeForEdit', () => {
  it('marca editável quando há link_data', () => {
    const r = analyzeCreativeForEdit({ id: 'c1', object_story_spec: { page_id: '1', link_data: { name: 'a', message: 'b' } } });
    expect(r.editable).toBe(true);
    expect(r.reason).toBeNull();
    expect(r.creative_id).toBe('c1');
    expect(r.story_spec).toBeTruthy();
  });

  it('marca editável quando há video_data', () => {
    const r = analyzeCreativeForEdit({ object_story_spec: { page_id: '1', video_data: { video_id: 'v', message: 'b' } } });
    expect(r.editable).toBe(true);
  });

  it('não editável e avisa quando é criativo dinâmico (asset_feed_spec)', () => {
    const r = analyzeCreativeForEdit({ asset_feed_spec: { titles: [{ text: 'a' }], bodies: [{ text: 'b' }] } });
    expect(r.editable).toBe(false);
    expect(r.reason).toContain('dinâmico');
  });

  it('não editável quando não há spec nenhum', () => {
    const r = analyzeCreativeForEdit({ id: 'c2' });
    expect(r.editable).toBe(false);
    expect(r.reason).toBeTruthy();
  });
});

describe('applyCopyToStorySpec', () => {
  it('substitui name/message do link_data e preserva imagem/link', () => {
    const spec = { page_id: 'p', link_data: { link: 'https://x.pt', image_hash: 'h1', name: 'velho', message: 'antigo', call_to_action: { type: 'LEARN_MORE', value: { link: 'https://x.pt' } } } };
    const r = applyCopyToStorySpec(spec, { title: 'novo título', body: 'novo texto', cta_type: 'MESSAGE_PAGE' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ld = r.spec.link_data as Record<string, unknown>;
    expect(ld.name).toBe('novo título');
    expect(ld.message).toBe('novo texto');
    expect(ld.image_hash).toBe('h1');
    expect(ld.link).toBe('https://x.pt');
    expect((ld.call_to_action as Record<string, unknown>).type).toBe('MESSAGE_PAGE');
    // preserva o value existente do CTA
    expect((ld.call_to_action as Record<string, Record<string, unknown>>).value.link).toBe('https://x.pt');
  });

  it('não muta o spec original (cópia profunda)', () => {
    const spec = { link_data: { name: 'velho', message: 'antigo' } };
    applyCopyToStorySpec(spec, { title: 'novo', body: 'novo', cta_type: null });
    expect((spec.link_data as Record<string, unknown>).name).toBe('velho');
  });

  it('deriva o value do CTA a partir do link quando não existia', () => {
    const spec = { link_data: { link: 'https://y.pt', name: 'n', message: 'm' } };
    const r = applyCopyToStorySpec(spec, { title: null, body: null, cta_type: 'CALL_NOW' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const cta = (r.spec.link_data as Record<string, Record<string, unknown>>).call_to_action;
    expect(cta.type).toBe('CALL_NOW');
    expect((cta.value as Record<string, unknown>).link).toBe('https://y.pt');
  });

  it('substitui title/message do video_data', () => {
    const spec = { video_data: { video_id: 'v', title: 'velho', message: 'antigo' } };
    const r = applyCopyToStorySpec(spec, { title: 'T2', body: 'B2', cta_type: null });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const vd = r.spec.video_data as Record<string, unknown>;
    expect(vd.title).toBe('T2');
    expect(vd.message).toBe('B2');
    expect(vd.video_id).toBe('v');
  });

  it('mantém o campo inalterado quando a copy vem null', () => {
    const spec = { link_data: { name: 'fica', message: 'muda' } };
    const r = applyCopyToStorySpec(spec, { title: null, body: 'novo', cta_type: null });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ld = r.spec.link_data as Record<string, unknown>;
    expect(ld.name).toBe('fica');
    expect(ld.message).toBe('novo');
  });

  it('rejeita specs sem link_data nem video_data', () => {
    const r = applyCopyToStorySpec({ photo_data: {} }, { title: 'x', body: 'y', cta_type: null });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain('dinâmico');
  });
});

describe('sanitizeStorySpecForCreate', () => {
  it('remove picture/image_url quando há image_hash no link_data', () => {
    const spec = { page_id: 'p', link_data: { link: 'https://x.pt', image_hash: 'h', picture: 'https://cdn/x.jpg', image_url: 'https://cdn/y.jpg', message: 'm', caption: 'x.pt' } };
    const out = sanitizeStorySpecForCreate(spec);
    const ld = out.link_data as Record<string, unknown>;
    expect(ld.image_hash).toBe('h');
    expect(ld.picture).toBeUndefined();
    expect(ld.image_url).toBeUndefined();
    expect(ld.caption).toBeUndefined();
    expect(ld.message).toBe('m');
  });

  it('mantém picture quando não há image_hash', () => {
    const spec = { link_data: { link: 'https://x.pt', picture: 'https://cdn/x.jpg', message: 'm' } };
    const out = sanitizeStorySpecForCreate(spec);
    expect((out.link_data as Record<string, unknown>).picture).toBe('https://cdn/x.jpg');
  });

  it('não muta o spec original', () => {
    const spec = { link_data: { image_hash: 'h', picture: 'u' } };
    sanitizeStorySpecForCreate(spec);
    expect((spec.link_data as Record<string, unknown>).picture).toBe('u');
  });
});
