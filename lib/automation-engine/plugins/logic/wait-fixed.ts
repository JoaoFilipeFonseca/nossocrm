// ============================================================================
// logic.wait_fixed — pausa a automação por X segundos
// ============================================================================
// Sprint 1.2, commit 2 de 4.
//
// Mecanismo:
// 1. O atom devolve { _suspend: true, _resumeAt: ISO }.
// 2. O executor detecta _suspend, marca automation_executions.status='waiting',
//    grava current_node_id + resume_at + variables, insere row em
//    automation_schedules e devolve sem percorrer mais nós.
// 3. O cron 'automation-resume-tick' (1x/min, Edge Function automation-resume)
//    lê schedules due, marca 'fired' e invoca automation-execute em modo
//    resume (passa execution_id), que carrega o estado e continua a partir
//    do próximo nó.
//
// Nunca propor Domingos (regra dura do projecto). Para isso há um helper
// que vai entrar no Sprint 4 logic.wait_until_business_hour. Este atom é
// "raw seconds", o utilizador é responsável pelo timing.
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

export const logicWaitFixed: AtomDefinition = {
  id: 'logic.wait_fixed',
  category: 'logic',
  name: 'Esperar tempo fixo',
  icon: '⏱️',
  description: 'Suspende a automação por X segundos antes de continuar.',

  configSchema: {
    type: 'object',
    properties: {
      seconds: {
        type: 'integer',
        minimum: 1,
        maximum: 60 * 60 * 24 * 30, // 30 dias máx
        description: 'Quantos segundos esperar antes de retomar.',
      },
    },
    required: ['seconds'],
  },

  outputSchema: {
    type: 'object',
    properties: {
      _suspend: { type: 'boolean' },
      _resumeAt: { type: 'string', format: 'date-time' },
      waited_seconds: { type: 'integer' },
    },
  },

  async execute(context: ExecutionContext): Promise<AtomOutput> {
    const seconds = Number(context.config.seconds ?? 0);
    if (seconds < 1) {
      // wait de 0 é no-op (continua imediatamente).
      return { waited_seconds: 0 };
    }
    const resumeAt = new Date(Date.now() + seconds * 1000).toISOString();
    return {
      _suspend: true,
      _resumeAt: resumeAt,
      waited_seconds: seconds,
    };
  },
};
