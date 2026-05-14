'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  itemName: string;
  itemType?: string;
  consequence?: string;
  keyword?: string;
}

export function DeleteConfirmModal({ isOpen, onClose, onConfirm, itemName, itemType, consequence, keyword = 'DELETE' }: DeleteConfirmModalProps) {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) { setTyped(''); setError(null); }
  }, [isOpen]);

  if (!isOpen) return null;

  const match = typed === keyword;

  async function handleConfirm() {
    if (!match || busy) return;
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
      onClose();
    } catch (e: any) {
      setError(String(e?.message || e));
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl max-w-md w-full p-5 sm:p-6 border border-slate-200 dark:border-slate-700" onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-slate-900 dark:text-white">Apagar {itemType || 'registo'}?</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 break-words">
              <span className="font-medium text-slate-900 dark:text-white">{itemName}</span>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 -mt-1 -mr-1" aria-label="Fechar"><X size={20} /></button>
        </div>

        {consequence && (
          <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mb-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-lg p-3">
            <strong className="text-red-700 dark:text-red-400">Atenção:</strong> {consequence}
          </div>
        )}

        <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
          Para confirmar, escreve <code className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 rounded font-mono text-xs">{keyword}</code> abaixo:
        </p>
        <input
          type="text"
          value={typed}
          onChange={e => setTyped(e.target.value)}
          autoFocus
          placeholder={keyword}
          className="w-full px-3 py-2 text-sm font-mono border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
        />

        {error && <div className="text-xs text-red-600 dark:text-red-400 mt-2">{error}</div>}

        <div className="flex gap-2 mt-5 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg">Cancelar</button>
          <button onClick={handleConfirm} disabled={!match || busy} className="px-4 py-2 text-sm font-medium bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg">
            {busy ? 'A apagar...' : 'Apagar definitivamente'}
          </button>
        </div>
      </div>
    </div>
  );
}
