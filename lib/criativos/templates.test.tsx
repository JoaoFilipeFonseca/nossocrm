import { describe, it, expect } from 'vitest';
import { dimensionsFor, hexOrDefault, brandFromKit, buildTemplate, FORMAT_LABELS, VARIANT_LABELS } from './templates';

describe('dimensionsFor — dimensões certas por formato', () => {
  it('anúncio é 1080×1080', () => {
    expect(dimensionsFor('anuncio')).toEqual({ width: 1080, height: 1080 });
  });
  it('post tem DOIS rácios de raiz: 1:1 e 4:5 (ideal IG)', () => {
    expect(dimensionsFor('post', 'square')).toEqual({ width: 1080, height: 1080 });
    expect(dimensionsFor('post', 'portrait')).toEqual({ width: 1080, height: 1350 });
  });
  it('story é 1080×1920 e flyer é A4 a 150dpi', () => {
    expect(dimensionsFor('story')).toEqual({ width: 1080, height: 1920 });
    expect(dimensionsFor('flyer')).toEqual({ width: 1240, height: 1754 });
  });
});

describe('hexOrDefault / brandFromKit', () => {
  it('aceita hex válido e rejeita lixo', () => {
    expect(hexOrDefault('#1A2b3C', '#000000')).toBe('#1A2b3C');
    expect(hexOrDefault('azul', '#000000')).toBe('#000000');
    expect(hexOrDefault(null, '#16324f')).toBe('#16324f');
    expect(hexOrDefault('#fff', '#16324f')).toBe('#16324f');
  });

  it('brandFromKit usa o Brand Kit e cai em fallbacks premium', () => {
    const b = brandFromKit({ brand_primary_color: '#112233', nome_profissional: 'Maria', ami: '12345' });
    expect(b.primary).toBe('#112233');
    expect(b.accent).toBe('#c8a24b');
    expect(b.nome).toBe('Maria');
    expect(b.ami).toBe('12345');
    const vazio = brandFromKit(null);
    expect(vazio.primary).toBe('#16324f');
    expect(vazio.nome).toBe('João Fonseca');
  });
});

describe('buildTemplate', () => {
  const brand = brandFromKit(null);
  const texts = { headline: 'Moradia T3 com jardim', sub: 'A 5 minutos do centro', cta: 'Envie mensagem com a palavra VISITA' };
  const imovel = { titulo: 'Moradia T3', local: 'Paços de Ferreira', preco: '285 000 €', detalhes: 'T3 · 152 m²', fotoUrl: null };

  it('devolve um elemento React para cada formato e variante', () => {
    for (const format of ['anuncio', 'post', 'story', 'flyer'] as const) {
      for (const variant of ['classico', 'faixa', 'claro'] as const) {
        const el = buildTemplate({ variant, format, ratio: 'portrait', brand, imovel, texts });
        expect(el).toBeTruthy();
        expect(typeof el.type).toBe('function');
      }
    }
  });

  it('labels completos', () => {
    expect(Object.keys(FORMAT_LABELS)).toHaveLength(4);
    expect(Object.keys(VARIANT_LABELS)).toHaveLength(3);
  });

  it('brandFromKit arranca sem logo (preenchido pelo route quando existe)', () => {
    expect(brandFromKit(null).logo).toBeNull();
    expect(brandFromKit(null).logoInverse).toBeNull();
  });
});

describe('logo do Brand Kit nos templates', () => {
  const texts = { headline: 'Moradia T3 com jardim', sub: null, cta: null };
  const logo = { uri: 'data:image/png;base64,AAAA', width: 320, height: 160 };

  /** Procura recursivamente um <img> com o src dado na árvore React (sem renderizar). */
  function findImg(node: unknown, src: string): boolean {
    if (!node || typeof node !== 'object') return false;
    const el = node as { type?: unknown; props?: Record<string, unknown> };
    if (el.type === 'img' && el.props?.src === src) return true;
    if (typeof el.type === 'function') {
      const rendered = (el.type as (p: unknown) => unknown)(el.props);
      return findImg(rendered, src);
    }
    const children = el.props?.children;
    const list = Array.isArray(children) ? children : children != null ? [children] : [];
    return list.some((c) => findImg(c, src));
  }

  it('com logo, o chip da marca usa a imagem em vez do nome', () => {
    const brand = { ...brandFromKit(null), logo };
    const el = buildTemplate({ variant: 'classico', format: 'post', ratio: 'square', brand, imovel: null, texts });
    expect(findImg(el, logo.uri)).toBe(true);
  });

  it('sem logo, não há imagem de marca (cai para o nome em texto)', () => {
    const el = buildTemplate({ variant: 'classico', format: 'post', ratio: 'square', brand: brandFromKit(null), imovel: null, texts });
    expect(findImg(el, logo.uri)).toBe(false);
  });

  it('o flyer usa o logo inverso no cabeçalho escuro', () => {
    const brand = { ...brandFromKit(null), logoInverse: logo };
    const el = buildTemplate({ variant: 'classico', format: 'flyer', brand, imovel: null, texts });
    expect(findImg(el, logo.uri)).toBe(true);
  });
});
