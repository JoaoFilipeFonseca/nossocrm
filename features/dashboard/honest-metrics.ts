import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Sprint 10 c2 — tipos das Métricas Honestas.
 * O cálculo vive na RPC Postgres `compute_honest_metrics` (ver migration
 * 20260527231000_honest_metrics_function.sql). Aqui só envolve a chamada
 * e expõe tipos fortes para a UI.
 */

export type Semaphore = 'red' | 'amber' | 'green' | 'unknown';

export type HonestMetricsWindows = {
  today_start: string;
  week_start: string;
  month_start: string;
  year_start: string;
};

export type ChqBreakdown = {
  today: number;
  week: number;
  month: number;
  types_counted: string[];
};

export type OpenProposals = {
  count: number;
  total_value_eur: number;
};

export type HonestGoal = {
  year: number;
  annual_target_eur: number;
  ytd_target_eur: number;
  ytd_realized_eur: number;
  gap_eur: number;
  pct: number | null;
  semaphore: Semaphore;
  has_goal: boolean;
};

export type StageConversionRow = {
  board_id: string;
  stage_id: string;
  stage_label: string;
  order: number;
  deals_in_or_past: number;
  deals_total_board: number;
  pct: number;
};

export type AvgTimePerStageRow = {
  stage_label: string;
  avg_days: number;
  samples: number;
};

export type HonestMetrics = {
  generated_at: string;
  organization_id: string;
  owner_id: string | null;
  year: number;
  windows: HonestMetricsWindows;
  chq: ChqBreakdown;
  meetings_visits_week: number;
  open_proposals: OpenProposals;
  weighted_pipeline_eur: number;
  goal: HonestGoal;
  stage_conversion: StageConversionRow[];
  avg_time_per_stage_days: AvgTimePerStageRow[];
};

export type GetHonestMetricsOptions = {
  ownerId?: string | null;
  year?: number | null;
};

/**
 * Chama a RPC `compute_honest_metrics` com o cliente Supabase fornecido.
 * O cliente deve estar autenticado (cookies/SSR) — a RPC é SECURITY DEFINER
 * mas exige `auth.uid()` válido e resolve a organização do utilizador.
 */
export async function getHonestMetrics(
  supabase: SupabaseClient,
  options: GetHonestMetricsOptions = {},
): Promise<HonestMetrics> {
  const { data, error } = await supabase.rpc('compute_honest_metrics', {
    p_owner: options.ownerId ?? null,
    p_year: options.year ?? null,
  });

  if (error) {
    throw new Error(`compute_honest_metrics failed: ${error.message}`);
  }
  if (!data) {
    throw new Error('compute_honest_metrics returned no data');
  }
  return data as HonestMetrics;
}
