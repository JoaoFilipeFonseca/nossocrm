import { describe, it, expect } from 'vitest';
import { extractCopyFromCreative, analyzeCreativeForEdit, applyCopyToStorySpec, sanitizeStorySpecForCreate, metaErrorMessage, extractTextsFromAssetFeedSpec, applyTextsToAssetFeedSpec, sanitizeAssetFeedSpecForCreate } from './write';

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

  it('marca dinâmico editável quando há asset_feed_spec com textos', () => {
    const r = analyzeCreativeForEdit({ asset_feed_spec: { titles: [{ text: 'a' }], bodies: [{ text: 'b' }] } });
    expect(r.editable).toBe(true);
    expect(r.kind).toBe('dynamic');
    expect(r.texts.titles).toEqual(['a']);
    expect(r.texts.bodies).toEqual(['b']);
  });

  it('story tem precedência sobre asset_feed_spec', () => {
    const r = analyzeCreativeForEdit({ object_story_spec: { link_data: { name: 'n', message: 'm' } }, asset_feed_spec: { titles: [{ text: 'a' }] } });
    expect(r.kind).toBe('story');
  });

  it('não editável quando não há spec nenhum', () => {
    const r = analyzeCreativeForEdit({ id: 'c2' });
    expect(r.editable).toBe(false);
    expect(r.kind).toBe('none');
    expect(r.reason).toBeTruthy();
  });
});

describe('extractTextsFromAssetFeedSpec', () => {
  it('lê titles/bodies/descriptions como arrays de strings', () => {
    const t = extractTextsFromAssetFeedSpec({
      titles: [{ text: 'T1' }, { text: 'T2' }],
      bodies: [{ text: 'B1' }],
      descriptions: [{ text: 'D1' }],
    });
    expect(t.titles).toEqual(['T1', 'T2']);
    expect(t.bodies).toEqual(['B1']);
    expect(t.descriptions).toEqual(['D1']);
  });

  it('ignora entradas vazias e campos em falta', () => {
    const t = extractTextsFromAssetFeedSpec({ titles: [{ text: '' }, { text: 'ok' }] });
    expect(t.titles).toEqual(['ok']);
    expect(t.bodies).toEqual([]);
    expect(t.descriptions).toEqual([]);
  });
});

describe('applyTextsToAssetFeedSpec', () => {
  it('substitui os textos e preserva imagens/formatos', () => {
    const afs = { titles: [{ text: 'velho' }], bodies: [{ text: 'antigo' }], images: [{ hash: 'h1' }], ad_formats: ['SINGLE_IMAGE'] };
    const r = applyTextsToAssetFeedSpec(afs, { titles: ['novo 1', 'novo 2'], bodies: ['corpo'], descriptions: [] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.titles).toEqual([{ text: 'novo 1' }, { text: 'novo 2' }]);
    expect(r.spec.bodies).toEqual([{ text: 'corpo' }]);
    expect(r.spec.images).toEqual([{ hash: 'h1' }]);
    expect(r.spec.ad_formats).toEqual(['SINGLE_IMAGE']);
    expect(r.spec.descriptions).toBeUndefined();
  });

  it('exige pelo menos um título e um texto', () => {
    const r = applyTextsToAssetFeedSpec({ titles: [], bodies: [] }, { titles: ['só título'], bodies: [], descriptions: [] });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.reason).toContain('título');
  });

  it('limpa espaços e remove vazios', () => {
    const r = applyTextsToAssetFeedSpec({}, { titles: ['  T  ', '  '], bodies: ['  B '], descriptions: ['  '] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.spec.titles).toEqual([{ text: 'T' }]);
    expect(r.spec.bodies).toEqual([{ text: 'B' }]);
    expect(r.spec.descriptions).toBeUndefined();
  });

  it('não muta o spec original', () => {
    const afs = { titles: [{ text: 'velho' }], bodies: [{ text: 'antigo' }] };
    applyTextsToAssetFeedSpec(afs, { titles: ['novo'], bodies: ['novo'], descriptions: [] });
    expect(afs.titles).toEqual([{ text: 'velho' }]);
  });
});

describe('sanitizeAssetFeedSpecForCreate', () => {
  it('remove url das imagens quando há hash', () => {
    const afs = { images: [{ hash: 'h', url: 'https://cdn/x.jpg', image_crops: {} }, { hash: 'h2' }] };
    const out = sanitizeAssetFeedSpecForCreate(afs);
    const imgs = out.images as Record<string, unknown>[];
    expect(imgs[0].url).toBeUndefined();
    expect(imgs[0].image_crops).toBeUndefined();
    expect(imgs[0].hash).toBe('h');
  });

  it('remove url dos vídeos quando há video_id', () => {
    const afs = { videos: [{ video_id: 'v', url: 'https://cdn/v.mp4' }] };
    const out = sanitizeAssetFeedSpecForCreate(afs);
    expect((out.videos as Record<string, unknown>[])[0].url).toBeUndefined();
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
    expect(r.reason).toBeTruthy();
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

describe('metaErrorMessage', () => {
  it('surfa o detalhe do error_user_msg', () => {
    const msg = metaErrorMessage({ error: { message: 'Invalid parameter', error_user_msg: 'Falta X', error_subcode: 999 } }, 400);
    expect(msg).toContain('Invalid parameter');
    expect(msg).toContain('Falta X');
    expect(msg).toContain('999');
  });

  it('acrescenta a dica accionável do ToS da Geração de Leads (1892181)', () => {
    const msg = metaErrorMessage({ error: { message: 'Invalid parameter', error_user_msg: 'Página não aceitou os termos', error_subcode: 1892181 } }, 400);
    expect(msg).toContain('Termos da Geração de Leads');
  });

  it('cai para mensagem genérica sem corpo de erro', () => {
    expect(metaErrorMessage({}, 500)).toContain('HTTP 500');
  });
});
