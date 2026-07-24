/**
 * PONTO 1 — "Verdade Única" do estado de um negócio.
 *
 * Tipos e rótulos para os sinais da RPC my_deal_state_signals (ver migração
 * 20260619140000). O estado é UMA definição = etapa + recência do último TOQUE
 * humano + actividades reais, distinguindo toque humano vs automação. Consumida
 * pelo Inbox (e, nas fatias seguintes, pelo score e Cérebro) para o painel
 * deixar de mentir com deals.updated_at.
 */

export type DealStatus = 'adiado' | 'por_trabalhar' | 'activo' | 'arrefecer' | 'parado';

export interface DealStateSignals {
  deal_id: string;
  board_id: string;
  board_name: string;
  stage_order: number;
  max_stage_order: number;
  is_holding: boolean;
  /** ISO ou null — último toque HUMANO (liguei/visita/msg manual). */
  last_human_touch: string | null;
  /** ISO ou null — último toque de AUTOMAÇÃO (email/WhatsApp automático, IA). */
  last_automation_touch: string | null;
  /** Dias desde o último toque humano (null se nunca houve). */
  days_since_human_touch: number | null;
  /** Dias parado = desde o último toque humano ou, se nunca houve, desde a entrada. */
  days_idle: number;
  human_touches: number;
  automation_touches: number;
  visits: number;
  open_tasks: number;
  overdue_tasks: number;
  snoozed_until: string | null;
  value: number | null;
  status: DealStatus;
}

export const STATUS_LABELS: Record<DealStatus, string> = {
  adiado: 'Adiado',
  por_trabalhar: 'Por trabalhar',
  activo: 'Activo',
  arrefecer: 'A arrefecer',
  parado: 'Parado',
};

/** Estados que contam como "risco" (precisam de atenção). Espera/adiado/activo não. */
export function isAtRisk(status: DealStatus): boolean {
  return status === 'parado' || status === 'arrefecer';
}

/**
 * DEFINIÇÃO ÚNICA de "negócio parado/em risco" para TODO o CRM (Painel, Kanban,
 * Dashboard). Verdade única = sinais de estado. Sem sinal → NÃO em risco (evita
 * os falsos alarmes da heurística antiga por updated_at). Usar sempre esta.
 */
export function dealAtRisk(state: DealStateSignals | undefined | null): boolean {
  return state ? isAtRisk(state.status) : false;
}

function daysAgoLabel(days: number | null): string | null {
  if (days == null) return null;
  if (days <= 0) return 'hoje';
  return `há ${days} dia${days === 1 ? '' : 's'}`;
}

/**
 * Frase honesta com AMBOS os toques (humano + automação) para o Inbox/sugestões.
 * Ex.: "Último contacto seu há 5 dias · automação enviou algo há 2 dias".
 */
export function touchSummary(s: DealStateSignals): string {
  const parts: string[] = [];
  const human = daysAgoLabel(s.days_since_human_touch);
  parts.push(human ? `Último contacto seu ${human}` : 'Ainda sem nenhum contacto seu');

  if (s.last_automation_touch) {
    const autoDays = Math.max(
      0,
      Math.floor((Date.now() - Date.parse(s.last_automation_touch)) / 86400000),
    );
    parts.push(`automação ${daysAgoLabel(autoDays)}`);
  }
  return parts.join(' · ');
}
