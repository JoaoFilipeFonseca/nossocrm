// ============================================================================
// logic.switch — multi-branch baseado num valor (1-de-N + default)
// ============================================================================
// Sprint 34 c1.
//
// Avalia expression contra a lista cases (strings) e escolhe a edge
// sourceHandle = 'case_<i>' onde i é o índice 0..N-1 do match. Se nenhum
// case bate, sai por sourceHandle 'default'. O executor já consome
// _branch_taken para escolher a saída.
//
// Edges esperadas no JSON:
//   { source: 'sw', sourceHandle: 'case_0', target: 'a' }
//   { source: 'sw', sourceHandle: 'case_1', target: 'b' }
//   { source: 'sw', sourceHandle: 'default', target: 'fallback' }
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

export const logicSwitch: AtomDefinition = {
  id: 'logic.switch',
  category: 'logic',
  name: 'Escolher (switch)',
  icon: '🔀',
  description: 'Compara um valor com a lista de casos e segue o ramo correspondente. Liga edges como case_0, case_1, ... e default.',

  configSchema: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'Valor a comparar. Suporta {{...}}.' },
      cases: {
        type: 'array',
        items: { type: 'string' },
        minItems: 1,
        description: 'Lista de valores possíveis (string). Comparação por igualdade case-insensitive.',
      },
    },
    required: ['expression', 'cases'],
  },

  outputSchema: {
    type: 'object',
    properties: {
      matched_case: { type: 'string' },
      matched_index: { type: 'integer' },
    },
  },

  timeoutMs: 2000,

  async execute(context: ExecutionContext): Promise<AtomOutput> {
    const expression = String(context.config.expression ?? '').trim().toLowerCase();
    const rawCases = Array.isArray(context.config.cases) ? (context.config.cases as unknown[]) : [];
    const cases = rawCases.map((v) => String(v ?? '').trim().toLowerCase());

    const idx = cases.indexOf(expression);
    if (idx === -1) {
      return { matched_case: null, matched_index: -1, _branch_taken: 'default' };
    }
    return {
      matched_case: rawCases[idx],
      matched_index: idx,
      _branch_taken: `case_${idx}`,
    };
  },
};
