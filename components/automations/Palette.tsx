'use client';

/**
 * Palette — lista de átomos draggable para o canvas.
 *
 * Sprint 2.2, commit 1.
 *
 * Lê ATOM_CATALOG (client-safe) e agrupa por categoria. Cada item arrasta-se
 * para o canvas com dataTransfer:
 *   - "application/reactflow" = atomId (consumido pelo Canvas.onDrop)
 *
 * Sem lógica de execução: a criação do nó é responsabilidade do Canvas.
 */

import { useMemo } from 'react';
import { ATOM_CATALOG, type AtomMetadata } from '@/lib/automation-engine/catalog';

const CATEGORY_LABEL: Record<AtomMetadata['category'], string> = {
  trigger: 'Gatilhos',
  action: 'Acções',
  logic: 'Lógica',
  data: 'Dados',
  observability: 'Observabilidade',
};

const CATEGORY_ORDER: AtomMetadata['category'][] = [
  'trigger',
  'action',
  'logic',
  'data',
  'observability',
];

function categoryChipClass(cat: AtomMetadata['category']): string {
  switch (cat) {
    case 'trigger': return 'border-emerald-300 bg-emerald-50 hover:bg-emerald-100';
    case 'action': return 'border-violet-300 bg-violet-50 hover:bg-violet-100';
    case 'logic': return 'border-amber-300 bg-amber-50 hover:bg-amber-100';
    case 'data': return 'border-blue-300 bg-blue-50 hover:bg-blue-100';
    case 'observability': return 'border-slate-300 bg-slate-50 hover:bg-slate-100';
  }
}

function onDragStart(event: React.DragEvent<HTMLDivElement>, atomId: string) {
  event.dataTransfer.setData('application/reactflow', atomId);
  event.dataTransfer.effectAllowed = 'move';
}

export interface PaletteProps {
  /** Em mobile, controla se o drawer está visível. Em desktop ignorado. */
  mobileOpen?: boolean;
  /** Callback ao fechar o drawer mobile (tap no backdrop ou X). */
  onMobileClose?: () => void;
}

export function Palette({ mobileOpen = false, onMobileClose }: PaletteProps = {}) {
  const grouped = useMemo(() => {
    const map = new Map<AtomMetadata['category'], AtomMetadata[]>();
    for (const atom of ATOM_CATALOG) {
      const list = map.get(atom.category) ?? [];
      list.push(atom);
      map.set(atom.category, list);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({ category: c, atoms: map.get(c)! }));
  }, []);

  const desktopClass = 'hidden md:flex md:flex-col w-60 shrink-0 border-r border-slate-200 bg-white overflow-y-auto';
  const mobileClass = mobileOpen
    ? 'flex flex-col fixed inset-y-0 left-0 w-72 max-w-[85vw] z-40 bg-white shadow-2xl border-r border-slate-200 overflow-y-auto md:hidden'
    : 'hidden';

  return (
    <>
      {/* Desktop sempre montado */}
      <aside className={desktopClass}>
        <PaletteContent grouped={grouped} />
      </aside>

      {/* Mobile drawer com backdrop */}
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onMobileClose}
        />
      ) : null}
      <aside className={mobileClass}>
        <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white">
          <div>
            <div className="text-xs font-semibold text-slate-700">Átomos</div>
            <div className="text-[10px] text-slate-400">Toca + arrasta para o canvas</div>
          </div>
          <button
            type="button"
            onClick={onMobileClose}
            className="text-slate-500 hover:text-slate-900 text-lg px-2"
            aria-label="Fechar palette"
          >
            ✕
          </button>
        </div>
        <PaletteContent grouped={grouped} />
      </aside>
    </>
  );
}

interface PaletteContentProps {
  grouped: Array<{ category: AtomMetadata['category']; atoms: AtomMetadata[] }>;
}

function PaletteContent({ grouped }: PaletteContentProps) {
  return (
    <>
      <div className="px-3 py-2 border-b border-slate-100 hidden md:block">
        <div className="text-xs font-semibold text-slate-700">Átomos</div>
        <div className="text-[10px] text-slate-400">Arrasta para o canvas</div>
      </div>
      <div className="p-2 space-y-3">
        {grouped.map(({ category, atoms }) => (
          <div key={category}>
            <div className="text-[10px] uppercase tracking-wide text-slate-400 px-1 mb-1">
              {CATEGORY_LABEL[category]}
            </div>
            <ul className="space-y-1.5">
              {atoms.map((atom) => (
                <li key={atom.id}>
                  <div
                    draggable
                    onDragStart={(e) => onDragStart(e, atom.id)}
                    className={`flex items-start gap-2 rounded-md border px-2 py-1.5 cursor-grab active:cursor-grabbing transition ${categoryChipClass(category)}`}
                    title={atom.description}
                  >
                    <span className="text-base leading-none mt-0.5">{atom.icon}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-medium text-slate-900 truncate">{atom.name}</div>
                      <div className="text-[10px] text-slate-500 truncate font-mono">{atom.id}</div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
