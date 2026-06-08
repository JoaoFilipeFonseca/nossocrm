import { describe, it, expect } from 'vitest';
import { computeDealCommission, toNumber } from './commission';

describe('toNumber', () => {
  it('aceita número, string PT e devolve null para lixo', () => {
    expect(toNumber(5)).toBe(5);
    expect(toNumber('1234,56')).toBeCloseTo(1234.56);
    expect(toNumber('5')).toBe(5);
    expect(toNumber('abc')).toBeNull();
    expect(toNumber(null)).toBeNull();
    expect(toNumber(undefined)).toBeNull();
  });
});

describe('computeDealCommission', () => {
  it('defaults da organização (5% × 50%) sobre o valor', () => {
    // 250.000 × 5% = 12.500 bruta → × 50% = 6.250 líquida
    const r = computeDealCommission({ value: 250000 }, {});
    expect(r.grossCents).toBe(1_250_000);
    expect(r.netCents).toBe(625_000);
    expect(r.netEuros).toBe(6250);
    expect(r.isOverride).toBe(false);
    expect(r.mode).toBe('pct');
  });

  it('usa defaults passados quando não há override', () => {
    const r = computeDealCommission({ value: 100000 }, { defaultPct: 4, defaultSharePct: 60 });
    // 100.000 × 4% = 4.000 → × 60% = 2.400
    expect(r.netEuros).toBe(2400);
  });

  it('override de percentagem e de parte do consultor', () => {
    const r = computeDealCommission(
      { value: 200000, custom_fields: { commission_pct: 6, consultant_share_pct: 70 } },
      { defaultPct: 5, defaultSharePct: 50 },
    );
    // 200.000 × 6% = 12.000 → × 70% = 8.400
    expect(r.netEuros).toBe(8400);
    expect(r.isOverride).toBe(true);
    expect(r.pct).toBe(6);
    expect(r.sharePct).toBe(70);
  });

  it('modo fixo usa o montante fixo, ignora a percentagem', () => {
    const r = computeDealCommission(
      { value: 999999, custom_fields: { commission_mode: 'fixed', commission_amount: 12500, consultant_share_pct: 50 } },
      {},
    );
    // fixo 12.500 → × 50% = 6.250
    expect(r.grossCents).toBe(1_250_000);
    expect(r.netCents).toBe(625_000);
    expect(r.mode).toBe('fixed');
    expect(r.isOverride).toBe(true);
  });

  it('strings PT em custom_fields e valor', () => {
    const r = computeDealCommission({ value: '150000', custom_fields: { commission_pct: '5' } }, {});
    // 150.000 × 5% = 7.500 → × 50% = 3.750
    expect(r.netEuros).toBe(3750);
  });

  it('valor em falta → comissão zero, sem rebentar', () => {
    const r = computeDealCommission({}, {});
    expect(r.netCents).toBe(0);
    expect(r.netEuros).toBe(0);
  });
});
