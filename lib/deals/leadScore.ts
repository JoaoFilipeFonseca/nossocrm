/**
 * DASH-2 — Lead scoring determinista por negócio (0 a 100) + temperatura + razões PT.
 *
 * Deriva tudo do histórico (sinais da RPC my_deal_lead_score_signals — sem tabelas novas):
 * etapa no funil, recência do último toque real, interacções (visitas pesam mais), valor.
 * Penaliza opt-out de email; "adiado" é um estado próprio (sem score, por decisão de UX:
 * adiado ressurge sozinho — ver CT-AUTO). A ORIGEM aparece nas razões mas NÃO pontua: ainda
 * não há histórico de conversões por canal que o justifique (entra com a medição vitalícia).
 * Regras v1 afináveis com o uso — maqueta aprovada: docs/mockups/dash2-lead-scoring.html.
 */

export interface LeadScoreSignals {
  deal_id: string;
  stage_order: number;
  max_stage_order: number;
  days_since_touch: number | null;
  touches: number;
  visits: number;
  value: number | null;
  snoozed_until: string | null; // YYYY-MM-DD
  email_opt_out: boolean;
  source: string | null;
}

export type LeadTemperature = 'quente' | 'morno' | 'frio' | 'adiado';

export interface LeadScore {
  dealId: string;
  score: number; // 0-100 (0 quando adiado)
  temperature: LeadTemperature;
  /** Razões curtas PT-PT; prefixo '+' contribui, '−' retira ou é contexto. */
  reasons: string[];
}

export const TEMPERATURE_LABELS: Record<LeadTemperature, string> = {
  quente: 'quente',
  morno: 'morno',
  frio: 'frio',
  adiado: 'adiado',
};

export const TEMPERATURE_ICONS: Record<LeadTemperature, string> = {
  quente: '🔥',
  morno: '🌤',
  frio: '❄',
  adiado: '⏸',
};

function isSnoozed(s: LeadScoreSignals, todayISO: string): boolean {
  return !!s.snoozed_until && s.snoozed_until >= todayISO.slice(0, 10);
}

/** Pontos da etapa: proporcional à posição no funil do board (1.ª etapa = 0; última = 35). */
export function stagePoints(stageOrder: number, maxStageOrder: number): number {
  if (maxStageOrder <= 0 || stageOrder <= 0) return 0;
  return Math.round(35 * Math.min(1, stageOrder / maxStageOrder));
}

/** Pontos da recência do último toque real (nunca tocado = 0). */
export function recencyPoints(daysSinceTouch: number | null): number {
  if (daysSinceTouch == null) return 0;
  if (daysSinceTouch <= 7) return 30;
  if (daysSinceTouch <= 30) return 20;
  if (daysSinceTouch <= 90) return 8;
  return 0;
}

/** Pontos das interacções: volume + bónus de visita/reunião. */
export function engagementPoints(touches: number, visits: number): number {
  let pts = 0;
  if (touches >= 5) pts += 15;
  else if (touches >= 2) pts += 10;
  else if (touches >= 1) pts += 5;
  if (visits >= 1) pts += 10;
  return pts;
}

/**
 * `todayISO` vem de fora (data do servidor/cliente no formato ISO) para o cálculo ser
 * determinista e testável — mesmo padrão do cmiCountdown.
 */
export function computeLeadScore(s: LeadScoreSignals, todayISO: string): LeadScore {
  if (isSnoozed(s, todayISO)) {
    const [y, m, d] = s.snoozed_until!.split('-');
    return {
      dealId: s.deal_id,
      score: 0,
      temperature: 'adiado',
      reasons: [`Adiado até ${d}/${m}/${y} (ressurge sozinho)`],
    };
  }

  const reasons: string[] = [];
  let score = 0;

  const sp = stagePoints(s.stage_order, s.max_stage_order);
  score += sp;
  if (sp > 0) reasons.push('+ Avançou no funil (etapa acima da inicial)');

  const rp = recencyPoints(s.days_since_touch);
  score += rp;
  if (s.days_since_touch == null) {
    reasons.push('− Ainda sem nenhum toque registado');
  } else if (rp >= 20) {
    reasons.push(`+ Último contacto há ${s.days_since_touch} dia${s.days_since_touch === 1 ? '' : 's'}`);
  } else {
    reasons.push(`− Parado há ${s.days_since_touch} dias`);
  }

  const ep = engagementPoints(s.touches, s.visits);
  score += ep;
  if (s.visits >= 1) {
    reasons.push(`+ ${s.visits} visita${s.visits === 1 ? '' : 's'}/reunião registadas`);
  } else if (s.touches >= 2) {
    reasons.push(`+ ${s.touches} interacções registadas`);
  }

  if (s.value != null && s.value > 0) {
    score += 5;
    reasons.push('+ Valor do negócio definido');
  }

  if (s.email_opt_out) {
    score -= 10;
    reasons.push('− Contacto pediu para não receber emails');
  }

  if (s.source) {
    reasons.push(`· Origem: ${s.source}`);
  }

  score = Math.max(0, Math.min(100, score));
  const temperature: LeadTemperature = score >= 65 ? 'quente' : score >= 35 ? 'morno' : 'frio';
  return { dealId: s.deal_id, score, temperature, reasons: reasons.slice(0, 5) };
}

/** Mapa deal_id → score, pronto para a DealCard e o modal. */
export function computeLeadScores(signals: LeadScoreSignals[], todayISO: string): Record<string, LeadScore> {
  const out: Record<string, LeadScore> = {};
  for (const s of signals) out[s.deal_id] = computeLeadScore(s, todayISO);
  return out;
}
