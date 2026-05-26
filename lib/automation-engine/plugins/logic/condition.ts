// ============================================================================
// logic.condition — avalia left OP right e bifurca em "true" / "false"
// ============================================================================
// Sprint 3.0 commit 4/4.
//
// Operadores: eq, neq, gt, gte, lt, lte, contains, starts_with, ends_with,
// in (right é array), is_empty (ignora right), is_not_empty.
//
// O resultado é gravado em output como { result: true|false }. O executor
// usa o output._branch_taken ('true' | 'false') para escolher a edge de
// saída via sourceHandle. Edges sem sourceHandle vão ser tomadas em qualquer
// caso (fallback). Para usar branches no JSON da definition:
//   edges: [
//     { id: 'e1', source: 'cond', target: 'a', sourceHandle: 'true' },
//     { id: 'e2', source: 'cond', target: 'b', sourceHandle: 'false' }
//   ]
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

export const logicCondition: AtomDefinition = {
  id: 'logic.condition',
  category: 'logic',
  name: 'Se / Então',
  icon: '🔀',
  description: 'Avalia uma condição. Bifurca o fluxo entre ramo "true" e "false".',

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
      result: { type: 'boolean' },
    },
  },

  timeoutMs: 2000,

  async execute(context: ExecutionContext): Promise<AtomOutput> {
    const op = String(context.config.operator ?? 'eq') as Op;
    const left = context.config.left;
    const right = context.config.right;
    const result = compare(left, op, right);
    return { result, _branch_taken: result ? 'true' : 'false' };
  },
};
