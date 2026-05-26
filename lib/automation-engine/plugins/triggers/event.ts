// ============================================================================
// trigger.event — dispara quando chega evento do tipo configurado
// ============================================================================
// Sprint 1.0, commit 1 de 5.
//
// É um trigger declarativo: a sua função execute é pass-through. O matching
// real entre eventos e automações acontece no automation-event-listener,
// que inspecciona o config.events deste nó.
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

export const triggerEvent: AtomDefinition = {
  id: 'trigger.event',
  category: 'trigger',
  name: 'Quando um evento acontece',
  icon: '⚡',
  description: 'Dispara quando um evento canónico do sistema é publicado.',

  configSchema: {
    type: 'object',
    properties: {
      events: {
        type: 'array',
        items: { type: 'string' },
        description: 'Lista de tipos de evento que disparam a automação (ex: contact.created).',
        minItems: 1,
      },
    },
    required: ['events'],
  },

  outputSchema: {
    type: 'object',
    properties: {
      event_type: { type: 'string' },
      payload: { type: 'object' },
    },
  },

  triggerSchema: {
    type: 'event',
  },

  async execute(context: ExecutionContext): Promise<AtomOutput> {
    // Pass-through: o trigger event apenas expõe o evento recebido aos nós seguintes.
    return {
      event_type: context.triggerEvent?.type ?? 'unknown',
      payload: context.triggerEvent?.payload ?? {},
    };
  },
};
