// IMO-6 Fase 2b — motor de avaliação do "vigia de CMI" (puro, sem efeitos).
// Dado o estado de um CMI activo e os sinais do imóvel, decide se há motivo
// para alertar o consultor, com que gravidade e qual a sugestão de acção.
// É reutilizado pela edge function `cmi-watch` (cron) que envia o alerta.

export interface CmiWatchThresholds {
  /** Alerta quando faltam <= N dias para o fim do CMI. */
  alertaFimDias: number;
  /** Considera "sem visitas há muito tempo" a partir de N dias. */
  semVisitaDias: number;
}

export const CMI_WATCH_DEFAULTS: CmiWatchThresholds = {
  alertaFimDias: 15,
  semVisitaDias: 21,
};

export interface CmiWatchInput {
  /** Dias até ao fim do CMI (de cmiCountdown): negativo se expirou, null se sem prazo. */
  daysToEnd: number | null;
  leads: number;        // negócios ligados ao imóvel
  visitas: number;
  propostas: number;
  diasSemVisita: number | null; // dias desde a última visita; null se nunca houve
}

export type CmiWatchSeverity = 'baixa' | 'media' | 'alta';

export interface CmiWatchResult {
  shouldAlert: boolean;
  severity: CmiWatchSeverity;
  reasons: string[];     // motivos legíveis (PT-PT)
  sugestao: string | null; // próxima acção sugerida
}

/**
 * Avalia um CMI activo. Não tem efeitos — devolve apenas a decisão.
 */
export function evaluateCmiWatch(
  input: CmiWatchInput,
  thresholds: CmiWatchThresholds = CMI_WATCH_DEFAULTS,
): CmiWatchResult {
  const { daysToEnd, leads, visitas, propostas, diasSemVisita } = input;
  const reasons: string[] = [];

  const expirado = daysToEnd != null && daysToEnd < 0;
  const fimProximo = daysToEnd != null && daysToEnd >= 0 && daysToEnd <= thresholds.alertaFimDias;

  if (expirado) {
    reasons.push(`CMI expirou há ${Math.abs(daysToEnd!)} dias`);
  } else if (fimProximo) {
    reasons.push(daysToEnd === 0 ? 'CMI termina hoje' : `CMI termina em ${daysToEnd} dias`);
  }

  const semVisitas = visitas === 0 || (diasSemVisita != null && diasSemVisita >= thresholds.semVisitaDias);
  if (visitas === 0) reasons.push('sem visitas registadas');
  else if (diasSemVisita != null && diasSemVisita >= thresholds.semVisitaDias) reasons.push(`${diasSemVisita} dias sem visitas`);

  if (propostas === 0) reasons.push('sem propostas');
  if (leads === 0) reasons.push('sem negócios associados');

  // Só vale a pena alertar se o fim está próximo/expirado OU se o imóvel está
  // claramente parado (sem visitas E sem propostas). Evita ruído.
  const parado = semVisitas && propostas === 0;
  const shouldAlert = expirado || fimProximo || parado;

  let severity: CmiWatchSeverity = 'baixa';
  if (expirado || (daysToEnd != null && daysToEnd >= 0 && daysToEnd <= 7)) severity = 'alta';
  else if (fimProximo || parado) severity = 'media';

  let sugestao: string | null = null;
  if (shouldAlert) {
    if (expirado) sugestao = 'Falar com o proprietário para renovar o CMI (ou retirar o imóvel).';
    else if (fimProximo && parado) sugestao = 'Renovar o CMI a tempo e rever a estratégia: preço, fotos e reactivar o anúncio.';
    else if (fimProximo) sugestao = 'Falar com o proprietário sobre a renovação do CMI antes do fim.';
    else if (parado) sugestao = 'Imóvel parado: rever preço/fotos, reactivar o anúncio e procurar compradores nos cruzamentos.';
  }

  return { shouldAlert, severity, reasons, sugestao };
}
