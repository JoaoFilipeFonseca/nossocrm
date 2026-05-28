// ============================================================================
// trigger.schedule — dispara periodicamente com base em cron expression
// ============================================================================
// Sprint 32 c1.
//
// Declarativo: nao executa logica, expoe payload sintetico aos nos seguintes.
// O matching real entre schedule e disparo acontece no edge tick
// `automation-schedule-tick` que olha `automation_triggers.next_run_at`.
//
// Cron expressions suportadas inicialmente (helper PG `automation_calc_next_schedule`):
//   - `*/N * * * *`     a cada N minutos
//   - `M H * * *`       diariamente as H:M (UTC)
//   - `M H * * D`       semanalmente DOW (0-6, dom-sab) as H:M
//   - `M H D * *`       mensalmente dia D as H:M
// Outros formatos devolvem NULL e recaem em fallback (1h adiante).
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

export const triggerSchedule: AtomDefinition = {
  id: 'trigger.schedule',
  category: 'trigger',
  name: 'Em horario programado',
  icon: '⏰',
  description: 'Dispara periodicamente segundo uma cron expression (UTC).',

  configSchema: {
    type: 'object',
    properties: {
      cron_expression: {
        type: 'string',
        description: 'Cron expression (5 campos). Ex: "0 7 * * 1-5" (seg-sex as 07:00 UTC).',
        minLength: 9,
      },
      timezone_note: {
        type: 'string',
        description: 'Apenas informativo. Cron e sempre em UTC.',
      },
    },
    required: ['cron_expression'],
  },

  outputSchema: {
    type: 'object',
    properties: {
      fired_at: { type: 'string', description: 'Timestamp ISO do disparo.' },
      cron_expression: { type: 'string' },
    },
  },

  triggerSchema: {
    type: 'schedule',
  },

  async execute(context: ExecutionContext): Promise<AtomOutput> {
    return {
      fired_at: new Date().toISOString(),
      cron_expression: (context.config?.cron_expression as string) ?? null,
    };
  },
};
