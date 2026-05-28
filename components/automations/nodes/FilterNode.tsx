'use client';

/**
 * FilterNode — custom node para logic.filter.
 *
 * Sprint 36 c2.
 *
 * 1 target esquerda + 1 source direita (pass — verde). Ramo "stop" não
 * tem handle: quando a condição falha o executor termina via `_halt`.
 * O utilizador só precisa de ligar o que continua se a condição passa.
 */

import { Handle, Position, type NodeProps } from '@xyflow/react';

interface FilterNodeData extends Record<string, unknown> {
  atom: string;
  config: Record<string, unknown>;
}

export function FilterNode({ data, selected }: NodeProps) {
  const config = (data as FilterNodeData)?.config ?? {};
  const left = typeof config.left === 'string' || typeof config.left === 'number' ? String(config.left) : '...';
  const op = typeof config.operator === 'string' ? config.operator : 'eq';
  const right = typeof config.right === 'string' || typeof config.right === 'number' ? String(config.right) : '...';

  return (
    <div
      className={`relative rounded-md border-2 shadow-sm bg-amber-50 ${selected ? 'border-amber-600' : 'border-amber-400'}`}
      style={{ minWidth: 200 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white"
      />

      <div className="px-3 py-2">
        <div className="flex flex-col items-center gap-0.5 text-[11px] leading-tight">
          <span className="text-base">🚦</span>
          <span className="font-medium text-slate-900">Filtrar</span>
          <span className="text-[10px] text-slate-500 font-mono">logic.filter</span>
        </div>
        <div className="mt-1.5 pt-1.5 border-t border-amber-200 text-[10px] text-slate-600 text-center font-mono truncate" title={`${left} ${op} ${right}`}>
          {left.length > 18 ? `${left.slice(0, 18)}…` : left} <span className="text-amber-700 font-bold">{op}</span> {right.length > 18 ? `${right.slice(0, 18)}…` : right}
        </div>
        <div className="mt-1 text-center text-[9px] text-slate-400 italic">
          falha → termina sem erro
        </div>
      </div>

      <Handle
        id="pass"
        type="source"
        position={Position.Right}
        className="!w-3.5 !h-3.5 !bg-emerald-500 !border-2 !border-white"
      >
        <span className="absolute left-4 -top-1 text-[10px] font-bold text-emerald-700 pointer-events-none whitespace-nowrap">
          passa
        </span>
      </Handle>
    </div>
  );
}
