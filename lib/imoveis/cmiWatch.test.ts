import { describe, it, expect } from 'vitest';
import { evaluateCmiWatch } from './cmiWatch';

const base = { daysToEnd: 90, leads: 2, visitas: 3, propostas: 1, diasSemVisita: 2 };

describe('evaluateCmiWatch', () => {
  it('CMI saudável e longe do fim → não alerta', () => {
    const r = evaluateCmiWatch(base);
    expect(r.shouldAlert).toBe(false);
    expect(r.severity).toBe('baixa');
    expect(r.sugestao).toBeNull();
  });

  it('fim próximo (≤15d) → alerta média + sugestão de renovação', () => {
    const r = evaluateCmiWatch({ ...base, daysToEnd: 12 });
    expect(r.shouldAlert).toBe(true);
    expect(r.severity).toBe('media');
    expect(r.reasons.some(x => x.includes('termina em 12 dias'))).toBe(true);
    expect(r.sugestao).toMatch(/renova/i);
  });

  it('fim muito próximo (≤7d) → gravidade alta', () => {
    expect(evaluateCmiWatch({ ...base, daysToEnd: 5 }).severity).toBe('alta');
  });

  it('expirado → alta + sugestão de renovar/retirar', () => {
    const r = evaluateCmiWatch({ ...base, daysToEnd: -3 });
    expect(r.shouldAlert).toBe(true);
    expect(r.severity).toBe('alta');
    expect(r.reasons[0]).toMatch(/expirou há 3 dias/);
  });

  it('imóvel parado (sem visitas e sem propostas) longe do fim → alerta média', () => {
    const r = evaluateCmiWatch({ daysToEnd: 90, leads: 0, visitas: 0, propostas: 0, diasSemVisita: null });
    expect(r.shouldAlert).toBe(true);
    expect(r.severity).toBe('media');
    expect(r.reasons).toContain('sem visitas registadas');
    expect(r.reasons).toContain('sem propostas');
    expect(r.sugestao).toMatch(/parado/i);
  });

  it('sem visitas há muito tempo mas com propostas e longe do fim → NÃO alerta (não está parado)', () => {
    const r = evaluateCmiWatch({ daysToEnd: 90, leads: 1, visitas: 0, propostas: 2, diasSemVisita: null });
    // visitas=0 gera motivo, mas há propostas → não está "parado" e fim longe → sem alerta
    expect(r.shouldAlert).toBe(false);
  });

  it('respeita limiares custom', () => {
    const r = evaluateCmiWatch({ ...base, daysToEnd: 20 }, { alertaFimDias: 30, semVisitaDias: 21 });
    expect(r.shouldAlert).toBe(true); // 20 <= 30
  });

  it('sem prazo (daysToEnd null) e activo mas não parado → não alerta', () => {
    expect(evaluateCmiWatch({ ...base, daysToEnd: null }).shouldAlert).toBe(false);
  });
});
