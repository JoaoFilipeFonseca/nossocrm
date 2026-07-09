// BRIEF 2 — Power List. Montagem do payload: mapear as linhas da RPC, calcular o
// número do dia e anexar a primeira frase da IA. Partilhado pela rota do cron e
// pela rota autenticada.

import type { SupabaseClient } from '@supabase/supabase-js';
import { generateOpeningLines, type OpeningLineInput } from './ai';
import type { NumeroDoDia, PowerListItem, PowerListBucket, Semaphore } from './types';

/** Linha crua vinda de public.power_list / public.my_power_list. */
export interface RawPowerListRow {
  deal_id: string;
  contact_id: string | null;
  contact_name: string | null;
  phone: string | null;
  board_name: string | null;
  stage_name: string | null;
  source: string | null;
  bucket: string;
  priority: number;
  status: string | null;
  last_human_touch: string | null;
  last_automation_touch: string | null;
  days_idle: number | null;
  value: number | null;
  reason: string;
}

export function buildNumeroDoDia(conversasSemana: number, meta: number): NumeroDoDia {
  const safeMeta = meta > 0 ? meta : 25;
  const week = Math.max(0, Math.round(conversasSemana || 0));
  const pct = safeMeta > 0 ? week / safeMeta : 0;
  let semaphore: Semaphore = 'red';
  if (pct >= 1) semaphore = 'green';
  else if (pct >= 0.5) semaphore = 'amber';
  return { conversasSemana: week, meta: safeMeta, pct, semaphore };
}

/**
 * Mapeia as linhas cruas para PowerListItem e anexa a frase de abertura da IA.
 * Nunca lança por causa da IA (cai em frases determinísticas).
 */
export async function assembleItems(
  supabase: SupabaseClient,
  organizationId: string,
  rows: RawPowerListRow[],
): Promise<PowerListItem[]> {
  const inputs: OpeningLineInput[] = rows.map((r) => ({
    contactName: r.contact_name || 'Contacto',
    source: r.source,
    boardName: r.board_name,
    bucket: (r.bucket as PowerListBucket) || 'reactivacao',
    status: r.status,
    daysIdle: r.days_idle,
  }));

  const openingLines = await generateOpeningLines(supabase, organizationId, inputs);

  return rows.map((r, i) => ({
    dealId: r.deal_id,
    contactId: r.contact_id,
    contactName: r.contact_name || 'Contacto',
    phone: r.phone,
    boardName: r.board_name,
    stageName: r.stage_name,
    source: r.source,
    bucket: (r.bucket as PowerListBucket) || 'reactivacao',
    priority: r.priority,
    status: r.status,
    lastHumanTouch: r.last_human_touch,
    lastAutomationTouch: r.last_automation_touch,
    daysIdle: r.days_idle,
    value: r.value,
    reason: r.reason,
    openingLine: openingLines[i],
  }));
}

/** Extrai chq.week do resultado de compute_honest_metrics[_for_org]. */
export function chqWeekFromMetrics(metrics: unknown): number {
  const m = metrics as { chq?: { week?: number } } | null;
  return Math.max(0, Math.round(m?.chq?.week ?? 0));
}
