// BRIEF 2 — Power List. Tipos partilhados entre a rota do cron (/api/power-list/run),
// a rota autenticada (/api/power-list) e a página /hoje.

export type PowerListBucket = 'lead_nova' | 'followup' | 'reactivacao';

/** Uma linha da RPC public.power_list, já com a frase de abertura da IA. */
export interface PowerListItem {
  dealId: string;
  contactId: string | null;
  contactName: string;
  phone: string | null;
  boardName: string | null;
  stageName: string | null;
  source: string | null;
  bucket: PowerListBucket;
  priority: number;
  status: string | null;
  lastHumanTouch: string | null;
  lastAutomationTouch: string | null;
  daysIdle: number | null;
  value: number | null;
  /** Motivo do contacto (gerado em SQL, determinista). */
  reason: string;
  /** Primeira frase sugerida (IA com fallback determinístico). */
  openingLine: string;
}

export type Semaphore = 'green' | 'amber' | 'red';

/** O "número do dia": conversas da semana vs meta, com semáforo. */
export interface NumeroDoDia {
  conversasSemana: number;
  meta: number;
  pct: number;
  semaphore: Semaphore;
}

export interface PowerListPayload {
  items: PowerListItem[];
  numeroDoDia: NumeroDoDia;
  generatedAt: string;
}
