import React, { useState, useEffect, useId } from 'react';
import { X, PauseCircle, Clock } from 'lucide-react';
import { FocusTrap, useFocusReturn } from '@/lib/a11y';

interface SnoozeDealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (snoozedUntilISO: string, reason: string) => void;
  dealTitle?: string;
}

function addMonthsISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

const QUICK = [
  { label: '3 meses', months: 3 },
  { label: '6 meses', months: 6 },
  { label: '1 ano', months: 12 },
];

/**
 * SnoozeDealModal — adiar um negócio em vez de o perder.
 * O negócio fica de fora da lista de follow-up e volta a aparecer na data escolhida.
 * Espelha o padrão do LossReasonModal (FocusTrap, role=dialog, Escape fecha).
 */
export const SnoozeDealModal: React.FC<SnoozeDealModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  dealTitle,
}) => {
  const [until, setUntil] = useState<string>(addMonthsISO(6)); // default 6 meses
  const [reason, setReason] = useState('');
  const [customMode, setCustomMode] = useState(false);

  const generatedId = useId();
  const titleId = `snooze-title-${generatedId}`;
  const descId = `snooze-desc-${generatedId}`;

  useFocusReturn({ enabled: isOpen });

  useEffect(() => {
    if (isOpen) {
      setUntil(addMonthsISO(6));
      setReason('');
      setCustomMode(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const todayISO = new Date().toISOString().slice(0, 10);
  const fmt = (iso: string) => {
    const parts = iso.split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : iso;
  };
  const valid = !!until && until > todayISO;

  const confirm = () => {
    if (valid) {
      onConfirm(until, reason.trim());
      onClose();
    }
  };

  return (
    <FocusTrap active={isOpen} onEscape={onClose} returnFocus>
      <div
        className="fixed inset-0 md:left-[var(--app-sidebar-width,0px)] z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
        onClick={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descId}
          className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center"
                aria-hidden="true"
              >
                <PauseCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <h3 id={titleId} className="font-bold text-slate-900 dark:text-white font-display">
                  Adiar negócio
                </h3>
                {dealTitle && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">
                    {dealTitle}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar modal"
              className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors focus-visible-ring"
            >
              <X className="w-5 h-5 text-slate-400" aria-hidden="true" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6">
            <p id={descId} className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Em vez de perder, adia para mais tarde. O negócio fica de fora da lista de
              follow-up e volta a aparecer na data escolhida.
            </p>

            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Prazos rápidos">
              {QUICK.map((q) => {
                const iso = addMonthsISO(q.months);
                const active = !customMode && until === iso;
                return (
                  <button
                    key={q.label}
                    type="button"
                    onClick={() => {
                      setCustomMode(false);
                      setUntil(iso);
                    }}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border transition-all focus-visible-ring ${
                      active
                        ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-500/60'
                        : 'border-slate-200 dark:border-white/10 hover:border-amber-300 dark:hover:border-amber-500/50'
                    }`}
                  >
                    <Clock
                      className={`w-4 h-4 ${active ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}`}
                      aria-hidden="true"
                    />
                    <span
                      className={`text-sm font-medium ${active ? 'text-amber-700 dark:text-amber-300' : 'text-slate-700 dark:text-slate-300'}`}
                    >
                      {q.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setCustomMode(true)}
              className={`mt-2 w-full text-left text-sm px-3 py-2 rounded-lg border transition-all focus-visible-ring ${
                customMode
                  ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-500/60 text-amber-700 dark:text-amber-300'
                  : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-amber-300'
              }`}
            >
              Escolher data à mão
            </button>
            {customMode && (
              <input
                type="date"
                min={todayISO}
                value={until}
                onChange={(e) => setUntil(e.target.value)}
                className="mt-2 w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
              />
            )}

            <label
              htmlFor={`snooze-reason-${generatedId}`}
              className="block mt-4 text-xs font-medium text-slate-500 dark:text-slate-400 mb-1"
            >
              Motivo (opcional)
            </label>
            <input
              id={`snooze-reason-${generatedId}`}
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex.: vai decidir só depois do verão"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-all"
            />

            <div className="flex gap-2 mt-5">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors focus-visible-ring"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={!valid}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-amber-600/20 transition-all focus-visible-ring"
              >
                Adiar até {fmt(until)}
              </button>
            </div>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
};

export default SnoozeDealModal;
