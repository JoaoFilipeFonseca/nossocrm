'use client';

/**
 * NodeConfigPanel — painel direito do builder visual para configurar o nó seleccionado.
 *
 * Sprint 33 c1.
 *
 * Recebe o nó actualmente seleccionado (ou null) e expõe o configSchema do
 * átomo correspondente via SchemaForm. As alterações sobem ao parent via
 * onConfigChange (sem debounce — o Canvas já tem o seu).
 *
 * Render minimal: empty state quando nada seleccionado, header com átomo, form
 * gerado, secção "ID interno" colapsada para debug.
 */

import { SchemaForm } from './SchemaForm';
import { getAtomMeta } from '@/lib/automation-engine/catalog';

export interface NodeConfigPanelProps {
  selectedNodeId: string | null;
  selectedAtomId: string | null;
  config: Record<string, unknown>;
  onConfigChange: (next: Record<string, unknown>) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  className?: string;
  /** Em mobile, controla se o drawer está visível (default false oculta tudo). */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function categoryChipClass(atomId: string): string {
  if (atomId.startsWith('trigger.')) return 'border-emerald-300 bg-emerald-50 text-emerald-800';
  if (atomId.startsWith('action.')) return 'border-violet-300 bg-violet-50 text-violet-800';
  if (atomId.startsWith('logic.')) return 'border-amber-300 bg-amber-50 text-amber-800';
  if (atomId.startsWith('data.')) return 'border-blue-300 bg-blue-50 text-blue-800';
  return 'border-slate-300 bg-slate-50 text-slate-700';
}

export function NodeConfigPanel({
  selectedNodeId,
  selectedAtomId,
  config,
  onConfigChange,
  onDuplicate,
  onDelete,
  className,
  mobileOpen = false,
  onMobileClose,
}: NodeConfigPanelProps) {
  const desktopBase = `hidden md:flex md:flex-col w-72 lg:w-80 shrink-0 border-l border-slate-200 bg-white overflow-y-auto ${className ?? ''}`;
  const mobileBase = mobileOpen
    ? `flex flex-col fixed inset-y-0 right-0 w-80 max-w-[90vw] z-40 bg-white shadow-2xl border-l border-slate-200 overflow-y-auto md:hidden`
    : 'hidden';

  if (!selectedNodeId || !selectedAtomId) {
    return (
      <>
        <aside className={desktopBase}>
          <EmptyState />
        </aside>
        {mobileOpen ? (
          <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onMobileClose} />
        ) : null}
        <aside className={mobileBase}>
          <MobileHeader onClose={onMobileClose} />
          <EmptyState />
        </aside>
      </>
    );
  }

  const meta = getAtomMeta(selectedAtomId);
  const schema = meta?.configSchema ?? {};

  const content = (
    <>
      <header className="px-3 py-2.5 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-start gap-2">
          <div className="text-xl leading-none mt-0.5">{meta?.icon ?? '❓'}</div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900 truncate">
              {meta?.name ?? selectedAtomId}
            </div>
            <div className={`inline-block mt-1 text-[10px] font-mono px-1.5 py-0.5 rounded border ${categoryChipClass(selectedAtomId)}`}>
              {selectedAtomId}
            </div>
            {meta?.description ? (
              <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">{meta.description}</p>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2.5">
          {onDuplicate ? (
            <button
              type="button"
              onClick={onDuplicate}
              className="text-[11px] rounded px-2 py-1 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700"
              title="Duplicar este nó"
            >
              ⎘ Duplicar
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              onClick={onDelete}
              className="text-[11px] rounded px-2 py-1 border border-red-200 bg-white hover:bg-red-50 text-red-700"
              title="Apagar este nó (Delete também funciona)"
            >
              🗑 Apagar
            </button>
          ) : null}
        </div>
      </header>

      <div className="p-3">
        <SchemaForm
          schema={schema}
          values={config}
          onChange={onConfigChange}
          showVarsHint
        />
      </div>

      <details className="border-t border-slate-100 px-3 py-2 text-[10px] text-slate-400">
        <summary className="cursor-pointer hover:text-slate-600">ID interno do nó</summary>
        <code className="mt-1 block font-mono text-slate-500 break-all">{selectedNodeId}</code>
      </details>
    </>
  );

  return (
    <>
      <aside className={desktopBase}>
        {content}
      </aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={onMobileClose} />
      ) : null}
      <aside className={mobileBase}>
        <MobileHeader onClose={onMobileClose} />
        {content}
      </aside>
    </>
  );
}

function EmptyState() {
  return (
    <div className="p-4 text-center text-slate-500">
      <div className="text-2xl mb-2">👉</div>
      <div className="text-sm font-medium text-slate-700">Nenhum nó seleccionado</div>
      <div className="text-xs mt-1 text-slate-500">
        Clica num nó do canvas para abrir as opções de configuração.
      </div>
    </div>
  );
}

function MobileHeader({ onClose }: { onClose?: () => void }) {
  return (
    <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
      <div className="text-xs font-semibold text-slate-700">Configurar nó</div>
      <button
        type="button"
        onClick={onClose}
        className="text-slate-500 hover:text-slate-900 text-lg px-2"
        aria-label="Fechar painel"
      >
        ✕
      </button>
    </div>
  );
}

