// ============================================================================
// data.set_variable — define uma variável named para uso a jusante
// ============================================================================
// Sprint 36 c5a.
//
// Util para acumular cálculos intermédios na execução. O valor fica
// acessível como {{ <node_id>.output.value }} pelos atomos seguintes.
// Suporta Liquid no campo value (ex: "{{ deal.value | money }}").
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

export const dataSetVariable: AtomDefinition = {
  id: 'data.set_variable',
  category: 'data',
  name: 'Guardar variável',
  icon: '📥',
  description: 'Guarda um valor numa variável reutilizável a jusante via {{ este_no.output.value }}.',

  configSchema: {
    type: 'object',
    properties: {
      value: { description: 'Valor a guardar. Suporta {{...}}. Pode ser string, número, etc.' },
    },
    required: ['value'],
  },

  outputSchema: {
    type: 'object',
    properties: {
      value: {},
    },
  },

  timeoutMs: 1000,

  async execute(context: ExecutionContext): Promise<AtomOutput> {
    return { value: context.config.value ?? null };
  },
};
