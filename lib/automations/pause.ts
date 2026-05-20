/**
 * Pause-on-touch helpers — #124
 *
 * Quando humano intervém num deal (move stage, retira tag, completa tarefa,
 * override manual), as automações associadas pausam até o humano clicar
 * "Retomar". Inspirado em Pinheirinho A1-A4.
 *
 * Filosofia: o humano é o boss. Decisões irreversíveis são sempre humanas.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type PauseReason =
  | 'moved_stage'
  | 'tag_removed'
  | 'manual_override'
  | 'task_completed';

export async function pauseDealAutomations(
  supabase: SupabaseClient,
  dealId: string,
  reason: PauseReason,
) {
  return supabase
    .from('deals')
    .update({
      automations_paused_at: new Date().toISOString(),
      automations_paused_reason: reason,
    })
    .eq('id', dealId);
}

export async function resumeDealAutomations(
  supabase: SupabaseClient,
  dealId: string,
) {
  return supabase
    .from('deals')
    .update({
      automations_paused_at: null,
      automations_paused_reason: null,
    })
    .eq('id', dealId);
}
