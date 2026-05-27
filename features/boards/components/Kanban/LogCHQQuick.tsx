'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Phone, Users, MapPin, MessageCircle, Mail, Check, MessageSquarePlus } from 'lucide-react';
import { useToast } from '@/context/ToastContext';

export type ChqType = 'call' | 'meeting' | 'visit' | 'whatsapp' | 'email';

type Action = {
  type: ChqType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

const ACTIONS: Action[] = [
  { type: 'call', label: 'Chamada', icon: Phone },
  { type: 'meeting', label: 'Reunião', icon: Users },
  { type: 'visit', label: 'Visita', icon: MapPin },
  { type: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { type: 'email', label: 'Email', icon: Mail },
];

interface LogCHQQuickProps {
  dealId: string;
  /** Sobrepor o botão trigger por defeito (opcional). */
  trigger?: React.ReactNode;
  onLogged?: (type: ChqType) => void;
}

/**
 * Atom de logging humano (Sprint 11 c1).
 * Botão pequeno que abre um popover com 5 tipos de CHQ.
 * Click rápido = grava sem descrição. Long-press / clique no "+" textarea =
 * permite adicionar nota antes de gravar.
 */
export const LogCHQQuick: React.FC<LogCHQQuickProps> = ({ dealId, trigger, onLogged }) => {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showNoteFor, setShowNoteFor] = useState<ChqType | null>(null);
  const [note, setNote] = useState('');
  const [justLogged, setJustLogged] = useState<ChqType | null>(null);
  const popRef = useRef<HTMLDivElement | null>(null);
  const { addToast } = useToast();

  // Fechar ao clicar fora
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (popRef.current && !popRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowNoteFor(null);
        setNote('');
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const submit = async (type: ChqType, description?: string) => {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(dealId)}/activities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, description: description?.trim() || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(json.error || 'Erro a registar CHQ', 'error');
        return;
      }
      addToast(`✓ ${labelFor(type)} registada`, 'success');
      setJustLogged(type);
      setTimeout(() => setJustLogged(null), 1500);
      setShowNoteFor(null);
      setNote('');
      setOpen(false);
      onLogged?.(type);
    } catch (e) {
      addToast((e as Error).message || 'Erro de rede', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative inline-block" ref={popRef}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title="Registar CHQ (Conversa Humana Qualificada)"
        className={`p-1.5 rounded-md transition-colors ${
          justLogged
            ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
            : 'text-slate-400 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-white/5'
        }`}
        aria-label="Registar Conversa Humana Qualificada"
        aria-expanded={open}
      >
        {justLogged ? <Check size={14} /> : (trigger ?? <MessageSquarePlus size={14} />)}
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute z-50 right-0 mt-1 w-56 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg shadow-lg p-2"
        >
          <div className="text-[10px] uppercase tracking-wide text-slate-400 px-2 py-1">
            Registar CHQ
          </div>

          {showNoteFor ? (
            <div className="p-2 space-y-2">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Nota para <strong>{labelFor(showNoteFor)}</strong> (opcional)
              </div>
              <textarea
                autoFocus
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                maxLength={2000}
                placeholder="Ex: combinou ver T2 sexta às 18h"
                className="w-full text-sm rounded-md border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-1 text-slate-900 dark:text-white"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowNoteFor(null);
                    setNote('');
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => submit(showNoteFor, note)}
                  className="text-xs bg-primary-500 hover:bg-primary-600 text-white rounded-md px-3 py-1 disabled:opacity-50"
                >
                  {submitting ? '...' : 'Gravar'}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-0.5">
              {ACTIONS.map((a) => (
                <div key={a.type} className="flex items-stretch">
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => submit(a.type)}
                    className="flex-1 flex items-center gap-2 px-2 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-l-md disabled:opacity-50"
                  >
                    <a.icon size={14} className="text-primary-500" />
                    {a.label}
                  </button>
                  <button
                    type="button"
                    title={`${a.label} com nota`}
                    disabled={submitting}
                    onClick={() => setShowNoteFor(a.type)}
                    className="px-2 text-slate-400 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-r-md border-l border-slate-100 dark:border-white/5"
                  >
                    +
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

function labelFor(t: ChqType): string {
  switch (t) {
    case 'call': return 'Chamada';
    case 'meeting': return 'Reunião';
    case 'visit': return 'Visita';
    case 'whatsapp': return 'WhatsApp';
    case 'email': return 'Email';
  }
}
