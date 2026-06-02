import { describe, it, expect } from 'vitest';
import { cmiCountdown } from './shared';

const NOW = '2026-06-02T10:00:00Z';

describe('cmiCountdown', () => {
  it('sem data_fim → estado "none"', () => {
    expect(cmiCountdown(null, NOW)).toEqual({ state: 'none', days: null });
  });

  it('mais de 30 dias → "ok" (verde)', () => {
    expect(cmiCountdown('2026-09-01', NOW)).toEqual({ state: 'ok', days: 91 });
  });

  it('entre 8 e 30 dias → "warn" (âmbar)', () => {
    expect(cmiCountdown('2026-06-20', NOW)).toEqual({ state: 'warn', days: 18 });
  });

  it('7 dias ou menos → "danger" (vermelho)', () => {
    expect(cmiCountdown('2026-06-08', NOW)).toEqual({ state: 'danger', days: 6 });
    expect(cmiCountdown('2026-06-09', NOW)).toEqual({ state: 'danger', days: 7 });
  });

  it('limiar exacto: 30 dias ainda é "warn"; 31 já é "ok"', () => {
    expect(cmiCountdown('2026-07-02', NOW).state).toBe('warn'); // 30 dias
    expect(cmiCountdown('2026-07-03', NOW).state).toBe('ok');   // 31 dias
  });

  it('data passada → "expired" com dias negativos', () => {
    expect(cmiCountdown('2025-12-01', NOW)).toEqual({ state: 'expired', days: -183 });
  });

  it('hoje → "danger" com 0 dias', () => {
    expect(cmiCountdown('2026-06-02', NOW)).toEqual({ state: 'danger', days: 0 });
  });
});
