'use client';

/**
 * LoopNode — custom node para logic.loop (forEach).
 *
 * Sprint 37 T5.
 *
 * Handles:
 *  - target esquerda (entrada): liga o passo anterior.
 *  - source "loop_body" (direita topo): liga ao primeiro passo do corpo.
 *  - target "loop_back" (fundo): liga aqui o último passo do corpo (back-edge);
 *    o runner reconhece a edge cujo target é este nó como fim de iteração.
 *  - source "loop_done" (direita fundo): segue quando a lista terminar.
 *
 * Cada iteração expõe {{ item }} e {{ index }} no scope.
 */

import { Handle, Position, type NodeProps } from '@xyflow/react';

interface LoopNodeData extends Record<string, unknown> {
  atom: string;
  config: Record<string, unknown>;
}

export function LoopNode({ data, selected }: NodeProps) {
  const config = (data as LoopNodeData)?.config ?? {};
  const items = typeof config.items === 'string' ? config.items : '...';
  const parallel = config.parallel === true || config.parallel === 'true';

  return (
    <div
      className={`relative rounded-md border-2 shadow-sm bg-amber-50 ${selected ? 'border-amber-600' : 'border-amber-400'}`}
      style={{ minWidth: 220, minHeight: 96 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white"
      />

      <div className="px-3 py-2">
        <div className="flex flex-col items-center gap-0.5 text-[11px] leading-tight">
          <span className="text-base">🔁</span>
          <span className="font-medium text-slate-900">Repetir por cada (loop)</span>
          <span className="text-[10px] text-slate-500 font-mono">logic.loop</span>
        </div>
        <div className="mt-1.5 pt-1.5 border-t border-amber-200 text-[10px] text-slate-600 text-center font-mono truncate" title={items}>
          {items.length > 24 ? `${items.slice(0, 24)}…` : items}
        </div>
        {parallel ? (
          <div className="mt-1 text-center text-[9px] font-bold text-amber-700">paralelo</div>
        ) : null}
      </div>

      {/* loop_body: ramo do corpo (topo direita) */}
      <Handle
        id="loop_body"
        type="source"
        position={Position.Right}
        style={{ top: 40, background: '#a855f7' }}
        className="!w-3.5 !h-3.5 !border-2 !border-white"
      >
        <span className="absolute left-4 -top-1 text-[10px] font-bold text-purple-600 pointer-events-none whitespace-nowrap">
          corpo
        </span>
      </Handle>

      {/* loop_done: continuação após terminar a lista (fundo direita) */}
      <Handle
        id="loop_done"
        type="source"
        position={Position.Right}
        style={{ top: 72, background: '#10b981' }}
        className="!w-3.5 !h-3.5 !border-2 !border-white"
      >
        <span className="absolute left-4 -top-1 text-[10px] font-bold text-emerald-600 pointer-events-none whitespace-nowrap">
          concluído
        </span>
      </Handle>

      {/* loop_back: fim do corpo volta aqui (fundo) */}
      <Handle
        id="loop_back"
        type="target"
        position={Position.Bottom}
        className="!w-3 !h-3 !bg-purple-400 !border-2 !border-white"
      >
        <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-bold text-purple-500 pointer-events-none whitespace-nowrap">
          fim do corpo
        </span>
      </Handle>
    </div>
  );
}
