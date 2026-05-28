'use client';

/**
 * BuilderTabs — toggle 3-way Escreve ↔ Linhas ↔ Visual.
 *
 * Sprint 9: adiciona modo Escreve (linguagem natural → IA gera automação).
 * Sprint 4.0: modo Linhas (passo-a-passo com SchemaForm).
 * Sprint 2.x: modo Visual (canvas React Flow + palette + branching).
 *
 * Default = Escreve (norte estratégico: consultor sem skills técnicas).
 */

import { useState } from 'react';
import { Canvas } from './Canvas';
import { Palette } from './Palette';
import { LinearBuilder } from './LinearBuilder';
import { WriteBuilder } from './WriteBuilder';

interface Definition {
  nodes: never[];
  edges: never[];
}

export interface BuilderTabsProps {
  automationId: string;
  definition: Definition;
}

type Mode = 'write' | 'linear' | 'visual';

export function BuilderTabs({ automationId, definition }: BuilderTabsProps) {
  const [mode, setMode] = useState<Mode>('write');
  const [mobilePaletteOpen, setMobilePaletteOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between px-2 py-1 mb-3">
        <div className="inline-flex rounded-md border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setMode('write')}
            className={`px-4 py-1.5 text-sm font-medium rounded-l-md transition ${
              mode === 'write' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            ✨ Escreve
          </button>
          <button
            type="button"
            onClick={() => setMode('linear')}
            className={`px-4 py-1.5 text-sm font-medium border-l border-slate-200 transition ${
              mode === 'linear' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            ☰ Linhas
          </button>
          <button
            type="button"
            onClick={() => setMode('visual')}
            className={`px-4 py-1.5 text-sm font-medium rounded-r-md border-l border-slate-200 transition ${
              mode === 'visual' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            🔀 Visual
          </button>
        </div>
        <p className="text-[11px] text-slate-500">
          {mode === 'write'
            ? 'Descreve em português, a IA gera. Mais simples.'
            : mode === 'linear'
              ? 'Constrói passo a passo. Form inline.'
              : 'Arrasta da palette e liga os nós. Para ramificações.'}
        </p>
      </div>

      {mode === 'write' ? (
        <WriteBuilder automationId={automationId} />
      ) : mode === 'linear' ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50/30 p-4">
          <LinearBuilder automationId={automationId} definition={definition} />
        </div>
      ) : (
        <div className="relative flex border border-slate-200 rounded-md overflow-hidden bg-slate-50 h-[720px]">
          <Palette
            mobileOpen={mobilePaletteOpen}
            onMobileClose={() => setMobilePaletteOpen(false)}
          />
          <div className="flex-1 min-w-0">
            <Canvas
              automationId={automationId}
              definition={definition}
              className="h-full bg-slate-50"
            />
          </div>
          {/* FAB mobile: abrir Palette */}
          <button
            type="button"
            onClick={() => setMobilePaletteOpen(true)}
            className="md:hidden absolute bottom-3 left-3 z-20 rounded-full bg-violet-600 hover:bg-violet-700 text-white shadow-lg w-12 h-12 flex items-center justify-center text-xl"
            aria-label="Abrir átomos"
            title="Abrir átomos"
          >
            ⚛
          </button>
        </div>
      )}
    </div>
  );
}
