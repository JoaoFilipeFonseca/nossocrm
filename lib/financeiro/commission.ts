// ============================================================================
// commission.ts — cálculo puro da comissão de um negócio (MA-CAPI + /financeiro)
// ============================================================================
// Fonte única da fórmula da comissão. Espelha o cálculo de
// app/api/deals/[id]/financeiro/route.ts para o valor da conversão enviado à
// Meta (negócio ganho → CAPI) ser EXACTAMENTE o ganho líquido que o João vê.
//
// Regras (decisão do João):
//   bruta   = modo fixo? montante fixo : valor × (percentagem / 100)
//   líquida = bruta × (parte do consultor / 100)
// Defaults da organização: 5% de comissão, 50% para o consultor. Overrides por
// negócio vivem em deals.custom_fields (commission_mode/pct/amount + share).
// ============================================================================

/** Converte string PT ("1.234,56" ou "5") ou número em número finito, ou null. */
export function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export interface CommissionDefaults {
  /** Percentagem de comissão por defeito da organização (ex.: 5). */
  defaultPct?: number | null;
  /** Parte do consultor por defeito da organização (ex.: 50). */
  defaultSharePct?: number | null;
}

export interface CommissionResult {
  mode: 'pct' | 'fixed';
  pct: number;
  sharePct: number;
  isOverride: boolean;
  grossCents: number;
  /** Comissão líquida (depois da parte do consultor), em cêntimos. */
  netCents: number;
  /** Comissão líquida em euros (para o valor da conversão CAPI). */
  netEuros: number;
}

/**
 * Calcula a comissão de um negócio a partir do seu valor e custom_fields.
 * Determinista e sem efeitos — seguro para servidor e testes.
 */
export function computeDealCommission(
  deal: { value?: unknown; custom_fields?: Record<string, unknown> | null },
  defaults: CommissionDefaults = {},
): CommissionResult {
  const defPct = toNumber(defaults.defaultPct) ?? 5;
  const defShare = toNumber(defaults.defaultSharePct) ?? 50;

  const cf = deal.custom_fields ?? {};
  const value = toNumber(deal.value) ?? 0;
  const mode: 'pct' | 'fixed' = (cf['commission_mode'] as string) === 'fixed' ? 'fixed' : 'pct';
  const overridePct = toNumber(cf['commission_pct']);
  const overrideAmount = toNumber(cf['commission_amount']);
  const overrideShare = toNumber(cf['consultant_share_pct']);

  const pct = overridePct ?? defPct;
  const share = overrideShare ?? defShare;
  const gross = mode === 'fixed' && overrideAmount != null ? overrideAmount : value * (pct / 100);
  const net = gross * (share / 100);

  return {
    mode,
    pct,
    sharePct: share,
    isOverride:
      overridePct != null || overrideAmount != null || overrideShare != null || cf['commission_mode'] != null,
    grossCents: Math.round(gross * 100),
    netCents: Math.round(net * 100),
    netEuros: Math.round(net * 100) / 100,
  };
}
