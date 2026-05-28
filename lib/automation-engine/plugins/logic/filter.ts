// ============================================================================
// logic.filter — termina a execução suavemente se a condição não bate
// ============================================================================
// Sprint 34 c2.
//
// Padrão: filtro "passa ou para". Operadores e semântica iguais a logic.condition.
//
// Output:
//   { passed: true/false, _branch_taken: 'pass' | 'stop', _halt: true (se stop) }
//
// _halt é interpretado pelo executor como "fim normal da execução" — status
// completed, sem erro, count preservado. Diferente de _suspend (waiting) e de
// erro (failed).
// ============================================================================

import type { AtomDefinition, AtomOutput, ExecutionContext } from '../../types';

type Op = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'starts_with' | 'ends_with' | 'in' | 'is_empty' | 'is_not_empty';

function compare(left: unknown, op: Op, right: unknown): boolean {
  switch (op) {
    case 'eq': return String(left ?? '') === String(right ?? '');
    case 'neq': return String(left ?? '') !== String(right ?? '');
    case 'gt': return Number(left) > Number(right);
    case 'gte': return Number(left) >= Number(right);
    case 'lt': return Number(left) < Number(right);
    case 'lte': return Number(left) <= Number(right);
    case 'contains': return String(left ?? '').toLowerCase().includes(String(right ?? '').toLowerCase());
    case 'starts_with': return String(left ?? '').toLowerCase().startsWith(String(right ?? '').toLowerCase());
    case 'ends_with': return String(left ?? '').toLowerCase().endsWith(String(right ?? '').toLowerCase());
    case 'in': {
      const arr = Array.isArray(right) ? right.map((x) => String(x)) : String(right ?? '').split(',').map((s) => s.trim());
      return arr.includes(String(left ?? ''));
    }
    case 'is_empty': return left === null || left === undefined || String(left).trim() === '';
    case 'is_not_empty': return !(left === null || left === undefined || String(left).trim() === '');
  }
}

export const logicFilter: AtomDefinition = {
  id: 'logic.filter',
  category: 'logic',
  name: 'Filtrar (continua só se)',
  icon: '🚦',
  description: 'Avalia uma condição. Se passa, continua. Se falha, termina a automação suavemente (sem erro).',

  configSchema: {
    type: 'object',
    properties: {
      left: { description: 'Valor à esquerda. Suporta {{...}}.' },
      operator: { type: 'string', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'starts_with', 'ends_with', 'in', 'is_empty', 'is_not_empty'] },
      right: { description: 'Valor à direita. Suporta {{...}}. Ignorado em is_empty/is_not_empty.' },
    },
    required: ['left', 'operator'],
  },

  outputSchema: {
    type: 'object',
    properties: {
      passed: { type: 'boolean' },
    },
  },

  timeoutMs: 2000,

  async execute(context: ExecutionContext): Promise<AtomOutput> {
    const op = String(context.config.operator ?? 'eq') as Op;
    const left = context.config.left;
    const right = context.config.right;
    const passed = compare(left, op, right);
    if (!passed) {
      return { passed: false, _branch_taken: 'stop', _halt: true };
    }
    return { passed: true, _branch_taken: 'pass' };
  },
};
