// ============================================================================
// action.log — escreve uma mensagem no histórico da execução
// ============================================================================
// Sprint 1.0, commit 1 de 5.
//
// Acção mais simples possível. Útil para:
// - Debug ("cheguei aqui").
// - Smoke tests do motor.
// - Marcadores em fluxos longos.
//
// A mensagem é renderizada via LiquidJS no Sprint 1.2. Por enquanto suporta
// apenas string literal.
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

export const actionLog: AtomDefinition = {
  id: 'action.log',
  category: 'action',
  name: 'Registar mensagem',
  icon: '📝',
  description: 'Escreve uma mensagem no histórico da execução.',

  configSchema: {
    type: 'object',
    properties: {
      message: {
        type: 'string',
        description: 'Texto a registar. Suporta variáveis {{...}} a partir do Sprint 1.2.',
      },
      level: {
        type: 'string',
        enum: ['debug', 'info', 'warn', 'error'],
        default: 'info',
      },
    },
    required: ['message'],
  },

  outputSchema: {
    type: 'object',
    properties: {
      message: { type: 'string' },
      level: { type: 'string' },
      logged_at: { type: 'string' },
    },
  },

  async execute(context: ExecutionContext): Promise<AtomOutput> {
    const message = String(context.config.message ?? '');
    const level = String(context.config.level ?? 'info') as 'debug' | 'info' | 'warn' | 'error';

    await context.log(level, message);

    return {
      message,
      level,
      logged_at: new Date().toISOString(),
    };
  },
};
