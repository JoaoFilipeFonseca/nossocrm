'use client';

/**
 * ConditionNode — custom node React Flow para logic.condition.
 *
 * Sprint 3.1, commit 1.
 *
 * Mostra 1 target handle (esquerda) + 2 source handles à direita:
 *   - id="true"  → topo, verde, label "Sim"
 *   - id="false" → fundo, vermelho, label "Não"
 *
 * Quando o utilizador puxa uma ligação a partir de um handle, React Flow
 * grava automaticamente `sourceHandle` na edge. O executor já sabe ler
 * isso e bifurcar conforme `_branch_taken` do output.
 */

import { Handle, Position, type NodeProps } from '@xyflow/react';

interface ConditionNodeData extends Record<string, unknown> {
  atom: string;
  config: Record<string, unknown>;
}

export function ConditionNode({ data, selected }: NodeProps) {
  const config = (data as ConditionNodeData)?.config ?? {};
  const left = typeof config.left === 'string' || typeof config.left === 'number' ? String(config.left) : '...';
  const op = typeof config.operator === 'string' ? config.operator : 'eq';
  const right = typeof config.right === 'string' || typeof config.right === 'number' ? String(config.right) : '...';

  return (
    <div
      className={`relative rounded-md border-2 shadow-sm bg-amber-50 ${selected ? 'border-amber-600' : 'border-amber-400'}`}
      style={{ minWidth: 180 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white"
      />

      <div className="px-3 py-2">
        <div className="flex flex-col items-center gap-0.5 text-[11px] leading-tight">
          <span className="text-base">🔀</span>
          <span className="font-medium text-slate-900">Se / Então</span>
          <span className="text-[10px] text-slate-500 font-mono">logic.condition</span>
        </div>
        <div className="mt-2 pt-2 border-t border-amber-200 text-[10px] text-slate-600 text-center font-mono truncate" title={`${left} ${op} ${right}`}>
          {left.length > 18 ? `${left.slice(0, 18)}…` : left} <span className="text-amber-700 font-bold">{op}</span> {right.length > 18 ? `${right.slice(0, 18)}…` : right}
        </div>
      </div>

      {/* Source handle TRUE (topo direita) */}
      <Handle
        id="true"
        type="source"
        position={Position.Right}
        style={{ top: '35%' }}
        className="!w-3.5 !h-3.5 !bg-emerald-500 !border-2 !border-white"
      >
        <span className="absolute left-4 -top-1 text-[10px] font-bold text-emerald-700 pointer-events-none whitespace-nowrap">Sim</span>
      </Handle>

      {/* Source handle FALSE (fundo direita) */}
      <Handle
        id="false"
        type="source"
        position={Position.Right}
        style={{ top: '70%' }}
        className="!w-3.5 !h-3.5 !bg-red-500 !border-2 !border-white"
      >
        <span className="absolute left-4 -top-1 text-[10px] font-bold text-red-700 pointer-events-none whitespace-nowrap">Não</span>
      </Handle>
    </div>
  );
}
