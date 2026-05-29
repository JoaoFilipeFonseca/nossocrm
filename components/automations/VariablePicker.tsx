'use client';

/**
 * VariablePicker — botão "＋ variável" que lista as variáveis disponíveis e as
 * insere (via onInsert) no campo associado.
 *
 * Sprint 37 Fase 2. Usa <details> para abrir/fechar sem estado extra.
 */

import { useRef } from 'react';
import { BUILDER_VARIABLES } from '@/lib/automation-engine/builder-catalog';

export interface VariablePickerProps {
  onInsert: (token: string) => void;
}

export function VariablePicker({ onInsert }: VariablePickerProps) {
  const detailsRef = useRef<HTMLDetailsElement | null>(null);
  const groups = Array.from(new Set(BUILDER_VARIABLES.map((v) => v.group)));

  const pick = (token: string) => {
    onInsert(token);
    if (detailsRef.current) detailsRef.current.open = false;
  };

  return (
    <details ref={detailsRef} className="relative inline-block">
      <summary className="cursor-pointer list-none text-[10px] font-medium text-violet-700 hover:text-violet-900 select-none">
        ＋ variável
      </summary>
      <div className="absolute right-0 z-20 mt-1 w-60 max-h-64 overflow-auto rounded border border-slate-200 bg-white p-1 shadow-lg">
        {groups.map((group) => (
          <div key={group} className="mb-1">
            <div className="px-1 text-[9px] font-semibold uppercase tracking-wide text-slate-400">{group}</div>
            {BUILDER_VARIABLES.filter((v) => v.group === group).map((v) => (
              <button
                key={v.token}
                type="button"
                onClick={() => pick(v.token)}
                className="block w-full rounded px-1.5 py-1 text-left text-[11px] text-slate-700 hover:bg-violet-50"
              >
                {v.label}
                <code className="ml-1 text-[10px] text-slate-400">{v.token}</code>
              </button>
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}
