// ============================================================================
// logic.wait_humanized — delay aleatório com janela humana PT
// ============================================================================
// Sprint 34 c3.
//
// Espera entre min_seconds e max_seconds (uniformemente aleatório). Se o
// resumeAt cair fora da janela "humana" em Europe/Lisbon, empurra para o
// início da próxima janela válida.
//
// Janela válida (regra dura do projecto — nunca Domingos, Sábado só manhã):
//   - Segunda a Sexta: 08h00 — 21h00
//   - Sábado:          09h00 — 13h00
//   - Domingo:         nunca
//
// Output:
//   { _suspend, _resumeAt, waited_seconds, shifted, original_resume_at }
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

type Weekday = 'Mon' | 'Tue' | 'Wed' | 'Thu' | 'Fri' | 'Sat' | 'Sun';

function lisbonParts(d: Date): { weekday: Weekday; hour: number } {
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Lisbon',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const weekday = (parts.find((p) => p.type === 'weekday')?.value ?? 'Mon') as Weekday;
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  return { weekday, hour };
}

export function isInsideHumanWindow(d: Date): boolean {
  const { weekday, hour } = lisbonParts(d);
  if (weekday === 'Sun') return false;
  if (weekday === 'Sat') return hour >= 9 && hour < 13;
  return hour >= 8 && hour < 21;
}

export function shiftToNextHumanWindow(d: Date): Date {
  const stepMs = 15 * 60 * 1000;
  const maxIter = 14 * 24 * 4;
  let cursor = new Date(d.getTime());
  for (let i = 0; i < maxIter; i += 1) {
    if (isInsideHumanWindow(cursor)) return cursor;
    cursor = new Date(cursor.getTime() + stepMs);
  }
  return cursor;
}

export const logicWaitHumanized: AtomDefinition = {
  id: 'logic.wait_humanized',
  category: 'logic',
  name: 'Esperar (humanizado)',
  icon: '🌤️',
  description: 'Espera entre min e max segundos (aleatório) e respeita horário humano PT (nunca Domingos; Sáb só 9h-13h; Seg-Sex 8h-21h).',

  configSchema: {
    type: 'object',
    properties: {
      min_seconds: {
        type: 'integer',
        minimum: 1,
        maximum: 60 * 60 * 24 * 30,
        description: 'Mínimo de segundos a esperar.',
      },
      max_seconds: {
        type: 'integer',
        minimum: 1,
        maximum: 60 * 60 * 24 * 30,
        description: 'Máximo de segundos a esperar.',
      },
    },
    required: ['min_seconds', 'max_seconds'],
  },

  outputSchema: {
    type: 'object',
    properties: {
      _suspend: { type: 'boolean' },
      _resumeAt: { type: 'string', format: 'date-time' },
      waited_seconds: { type: 'integer' },
      shifted: { type: 'boolean' },
      original_resume_at: { type: 'string', format: 'date-time' },
    },
  },

  async execute(context: ExecutionContext): Promise<AtomOutput> {
    const minS = Math.max(1, Number(context.config.min_seconds ?? 60));
    const maxS = Math.max(minS, Number(context.config.max_seconds ?? minS));
    const span = maxS - minS;
    const randomS = span === 0 ? minS : minS + Math.floor(Math.random() * (span + 1));

    const now = Date.now();
    const target = new Date(now + randomS * 1000);
    const final = isInsideHumanWindow(target) ? target : shiftToNextHumanWindow(target);
    const shifted = final.getTime() !== target.getTime();
    const waitedSeconds = Math.round((final.getTime() - now) / 1000);

    return {
      _suspend: true,
      _resumeAt: final.toISOString(),
      waited_seconds: waitedSeconds,
      shifted,
      original_resume_at: target.toISOString(),
    };
  },
};
