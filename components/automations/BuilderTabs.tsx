'use client';

/**
 * BuilderTabs — toggle Visual ↔ Linhas no builder de uma automação.
 *
 * Sprint 4.0, commit 2.
 *
 * Estado local cliente. Default = Linhas (mais acessível para consultor
 * sem skills técnicas, alinhado com norte estratégico). Botão troca entre
 * as duas vistas. Ambas escrevem para a mesma BD via PATCH.
 */

import { useState } from 'react';
import { Canvas } from './Canvas';
import { Palette } from './Palette';
import { LinearBuilder } from './LinearBuilder';

interface Definition {
  nodes: never[];
  edges: never[];
}

export interface BuilderTabsProps {
  automationId: string;
  definition: Definition;
}

type Mode = 'linear' | 'visual';

export function BuilderTabs({ automationId, definition }: BuilderTabsProps) {
  const [mode, setMode] = useState<Mode>('linear');

  return (
    <div>
      <div className="flex items-center justify-between px-2 py-1 mb-3">
        <div className="inline-flex rounded-md border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setMode('linear')}
            className={`px-4 py-1.5 text-sm font-medium rounded-l-md transition ${
              mode === 'linear'
                ? 'bg-violet-600 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            ☰ Linhas
          </button>
          <button
            type="button"
            onClick={() => setMode('visual')}
            className={`px-4 py-1.5 text-sm font-medium rounded-r-md border-l border-slate-200 transition ${
              mode === 'visual'
                ? 'bg-violet-600 text-white'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            🔀 Visual
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          {mode === 'linear'
            ? 'Constrói passo a passo. Mais simples.'
            : 'Arrasta da palette e liga os nós. Suporta ramificações.'}
        </p>
      </div>

      {mode === 'linear' ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/30 p-4">
          <LinearBuilder automationId={automationId} definition={definition} />
        </div>
      ) : (
        <div className="flex border border-slate-200 rounded-md overflow-hidden bg-slate-50 h-[720px]">
          <Palette />
          <div className="flex-1 min-w-0">
            <Canvas
              automationId={automationId}
              definition={definition}
              className="h-full bg-slate-50"
            />
          </div>
        </div>
      )}
    </div>
  );
}
