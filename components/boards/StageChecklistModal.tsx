'use client';

/**
 * StageChecklistModal — modal não bloqueante mostrado ao mover deal para stage.
 *
 * Sprint 36 c6 M-012.
 *
 * Carrega items de stage_checklists para a board+stage destino. Se vazio
 * (a stage não tem checklist definida), não monta. Caso contrário, lista
 * checkboxes com label + flag required.
 *
 * Botões:
 *   - "Já tratei" → onConfirm: marca todos completed, fecha
 *   - "Avançar mesmo assim" → onSkip: regista skip no console (audit log
 *      podia ir aqui) e fecha
 *   - "Voltar atrás" → onCancel: cancela a mudança de stage
 */

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ChecklistItem {
  label: string;
  required?: boolean;
}

export interface StageChecklistModalProps {
  organizationId: string;
  boardId: string;
  toStageId: string;
  toStageName: string;
  dealTitle: string;
  onConfirm: () => void;
  onSkip: () => void;
  onCancel: () => void;
}

export function StageChecklistModal({
  organizationId,
  boardId,
  toStageId,
  toStageName,
  dealTitle,
  onConfirm,
  onSkip,
  onCancel,
}: StageChecklistModalProps) {
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const supabase = createClient();
    if (!supabase) {
      setLoading(false);
      setItems([]);
      return;
    }
    void supabase
      .from('stage_checklists')
      .select('items')
      .eq('organization_id', organizationId)
      .eq('board_id', boardId)
      .eq('stage_id', toStageId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const raw = Array.isArray(data?.items) ? (data!.items as unknown[]) : [];
        setItems(raw.map((i) => {
          if (i && typeof i === 'object' && 'label' in i) {
            const o = i as { label: unknown; required?: unknown };
            return { label: String(o.label ?? ''), required: Boolean(o.required) };
          }
          return { label: String(i ?? ''), required: false };
        }).filter((x) => x.label.trim().length > 0));
        setLoading(false);
      });
    return () => { active = false; };
  }, [organizationId, boardId, toStageId]);

  useEffect(() => {
    if (items && items.length === 0 && !loading) {
      // Sem checklist definida: passa directo, fecha sem mostrar nada
      onConfirm();
    }
  }, [items, loading, onConfirm]);

  if (loading || !items || items.length === 0) return null;

  const requiredIdx = items.map((it, i) => ({ it, i })).filter((x) => x.it.required).map((x) => x.i);
  const allRequiredChecked = requiredIdx.every((i) => checked.has(i));

  function toggle(i: number) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onCancel}>
      <div
        className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Antes de mover para «{toStageName}»
          </h2>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 truncate">{dealTitle}</p>
        </header>

        <div className="px-5 py-4 overflow-y-auto">
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">
            Verifica antes de avançar:
          </p>
          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={i}>
                <label className="flex items-start gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={checked.has(i)}
                    onChange={() => toggle(i)}
                    className="mt-0.5 w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white">
                    {it.label}
                    {it.required ? <span className="ml-1.5 text-[10px] text-red-500 font-medium align-middle">obrigatório</span> : null}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>

        <footer className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white px-3 py-1.5"
          >
            Voltar atrás
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onSkip}
              className="text-xs text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 px-3 py-1.5 rounded"
              title="Avança sem completar — fica registado"
            >
              Avançar mesmo assim
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!allRequiredChecked}
              className="text-xs font-medium bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded"
            >
              Já tratei, avançar
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
