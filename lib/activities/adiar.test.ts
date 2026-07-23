import { describe, it, expect } from 'vitest';
import { adiarParaAmanha } from './adiar';

// Referência de "agora": Sexta, 24 Jul 2026, 10:00 locais.
const now = new Date(2026, 6, 24, 10, 0, 0);

describe('adiarParaAmanha', () => {
  it('adia uma tarefa de hoje para amanhã, mantendo a hora', () => {
    const hoje = new Date(2026, 6, 24, 14, 30, 0).toISOString();
    const r = adiarParaAmanha(hoje, 1, now);
    expect(r.getFullYear()).toBe(2026);
    expect(r.getMonth()).toBe(6);
    expect(r.getDate()).toBe(25); // Sábado 25
    expect(r.getHours()).toBe(14);
    expect(r.getMinutes()).toBe(30);
  });

  it('nunca cai num Domingo — salta para Segunda', () => {
    // Sábado 25 Jul + 1 = Domingo 26 → deve saltar para Segunda 27.
    const sabado = new Date(2026, 6, 25, 9, 0, 0).toISOString();
    const r = adiarParaAmanha(sabado, 1, now);
    expect(r.getDay()).not.toBe(0);
    expect(r.getDate()).toBe(27);
  });

  it('tarefa atrasada vai para amanhã real, não para "um dia após o atraso"', () => {
    // Atrasada 3 dias (21 Jul). Adiar deve dar amanhã (25), não 22.
    const atrasada = new Date(2026, 6, 21, 11, 0, 0).toISOString();
    const r = adiarParaAmanha(atrasada, 1, now);
    expect(r.getDate()).toBe(25);
    expect(r.getHours()).toBe(11);
  });

  it('tarefa futura adia a partir da própria data', () => {
    // Futura (28 Jul, Terça). Adiar +1 = 29 (Quarta).
    const futura = new Date(2026, 6, 28, 16, 0, 0).toISOString();
    const r = adiarParaAmanha(futura, 1, now);
    expect(r.getDate()).toBe(29);
  });
});
