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
      for (const variant of ['classico', 'faixa'] as const) {
        const el = buildTemplate({ variant, format, ratio: 'portrait', brand, imovel, texts });
        expect(el).toBeTruthy();
        expect(typeof el.type).toBe('function');
      }
    }
  });

  it('labels completos', () => {
    expect(Object.keys(FORMAT_LABELS)).toHaveLength(4);
    expect(Object.keys(VARIANT_LABELS)).toHaveLength(2);
  });
});
