'use client';

/**
 * SwitchNode — custom node para logic.switch.
 *
 * Sprint 36 c1.
 *
 * Handles dinâmicos por case: 1 target esquerda, N source direita (case_0..case_N-1)
 * + 1 default no fundo. O número de cases vem de data.config.cases (array).
 *
 * Edges puxadas a partir destes handles ficam automaticamente com
 * sourceHandle = 'case_0' | 'case_1' | ... | 'default'. O executor
 * já bifurca conforme `_branch_taken`.
 */

import { Handle, Position, type NodeProps } from '@xyflow/react';

interface SwitchNodeData extends Record<string, unknown> {
  atom: string;
  config: Record<string, unknown>;
}

const HANDLE_COLORS = ['#10b981', '#3b82f6', '#a855f7', '#ec4899', '#f59e0b', '#06b6d4', '#84cc16', '#f97316'];

export function SwitchNode({ data, selected }: NodeProps) {
  const config = (data as SwitchNodeData)?.config ?? {};
  const expression = typeof config.expression === 'string' ? config.expression : '...';
  const cases = Array.isArray(config.cases) ? (config.cases as unknown[]).map((c) => String(c)) : [];
  const safeCases = cases.length > 0 ? cases : ['—'];

  const rowHeight = 22;
  const headerHeight = 64;
  const footerHeight = 28;
  const totalHeight = headerHeight + safeCases.length * rowHeight + footerHeight;

  return (
    <div
      className={`relative rounded-md border-2 shadow-sm bg-amber-50 ${selected ? 'border-amber-600' : 'border-amber-400'}`}
      style={{ minWidth: 220, minHeight: totalHeight }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-slate-400 !border-2 !border-white"
      />

      <div className="px-3 py-2">
        <div className="flex flex-col items-center gap-0.5 text-[11px] leading-tight">
          <span className="text-base">🔀</span>
          <span className="font-medium text-slate-900">Escolher (switch)</span>
          <span className="text-[10px] text-slate-500 font-mono">logic.switch</span>
        </div>
        <div className="mt-1.5 pt-1.5 border-t border-amber-200 text-[10px] text-slate-600 text-center font-mono truncate" title={expression}>
          {expression.length > 24 ? `${expression.slice(0, 24)}…` : expression}
        </div>
      </div>

      {safeCases.map((caseValue, idx) => {
        const top = headerHeight + idx * rowHeight + rowHeight / 2;
        const color = HANDLE_COLORS[idx % HANDLE_COLORS.length];
        const label = caseValue.length > 16 ? `${caseValue.slice(0, 16)}…` : caseValue;
        return (
          <Handle
            key={`case_${idx}`}
            id={`case_${idx}`}
            type="source"
            position={Position.Right}
            style={{ top, background: color }}
            className="!w-3.5 !h-3.5 !border-2 !border-white"
          >
            <span
              className="absolute left-4 -top-1 text-[10px] font-bold pointer-events-none whitespace-nowrap"
              style={{ color }}
            >
              {label}
            </span>
          </Handle>
        );
      })}

      <Handle
        id="default"
        type="source"
        position={Position.Right}
        style={{ top: headerHeight + safeCases.length * rowHeight + footerHeight / 2 }}
        className="!w-3.5 !h-3.5 !bg-slate-400 !border-2 !border-white"
      >
        <span className="absolute left-4 -top-1 text-[10px] font-bold text-slate-600 pointer-events-none whitespace-nowrap">
          default
        </span>
      </Handle>
    </div>
  );
}
