'use client';

import React from 'react';
import { Mic, MicOff, StickyNote, Phone } from 'lucide-react';
import { CHANNELS, RESULTS, CHANNEL_META, RESULT_META, type Channel, type Result } from '@/lib/activities/vocab';
import { useDictation } from '@/lib/activities/useDictation';

export interface ActivityLogPayload {
  type: Channel | 'note';
  description: string | null;
  result: Result | null;
  occurredAt?: string;
}

interface ActivityLogFormProps {
  onSubmit: (payload: ActivityLogPayload) => Promise<void> | void;
  submitting?: boolean;
  onClose?: () => void;
}

const inputCls =
  'w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500';

export function ActivityLogForm({ onSubmit, submitting = false, onClose }: ActivityLogFormProps) {
  const [tab, setTab] = React.useState<'contacto' | 'nota'>('contacto');
  const [channel, setChannel] = React.useState<Channel>('call');
  const [result, setResult] = React.useState<Result | ''>('');
  const [content, setContent] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const appendDictated = React.useCallback((text: string) => {
    setContent((prev) => (prev ? `${prev} ${text}` : text));
  }, []);
  const { supported: micSupported, listening, toggle } = useDictation(appendDictated);

  const submit = async () => {
    setError(null);
    if (tab === 'nota') {
      if (!content.trim()) { setError('Escreva a nota.'); return; }
      await onSubmit({ type: 'note', description: content.trim(), result: null });
      setContent('');
      return;
    }
    // aba Contacto
    if (!result) { setError('Escolha o resultado.'); return; }
    await onSubmit({ type: channel, description: content.trim() || null, result });
    setContent('');
    setResult('');
  };

  return (
    <div>
      {/* Abas Nota | Contacto */}
      <div className="flex rounded-lg bg-slate-100 dark:bg-white/5 p-1 mb-4">
        <button
          type="button"
          onClick={() => { setTab('nota'); setError(null); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm font-semibold rounded-md transition-colors ${
            tab === 'nota'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <StickyNote size={15} /> Nota
        </button>
        <button
          type="button"
          onClick={() => { setTab('contacto'); setError(null); }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-sm font-semibold rounded-md transition-colors ${
            tab === 'contacto'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
              : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Phone size={15} /> Contacto
        </button>
      </div>

      {tab === 'contacto' && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Canal</label>
            <select className={inputCls} value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
              {CHANNELS.map((c) => (
                <option key={c} value={c}>{CHANNEL_META[c].icon} {CHANNEL_META[c].label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Resultado</label>
            <select className={inputCls} value={result} onChange={(e) => setResult(e.target.value as Result | '')}>
              <option value="" disabled>— escolher —</option>
              {RESULTS.map((r) => (
                <option key={r} value={r}>{RESULT_META[r].label}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="relative">
        <textarea
          rows={3}
          className={`${inputCls} ${micSupported ? 'pr-10' : ''}`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={tab === 'nota' ? 'Escreva a nota…' : 'O que se falou? (opcional — texto ou microfone)'}
        />
        {micSupported && (
          <button
            type="button"
            onClick={toggle}
            aria-label={listening ? 'Parar ditado' : 'Ditar por voz'}
            title={listening ? 'Parar ditado' : 'Ditar por voz'}
            className={`absolute right-2 top-2 p-1.5 rounded-md transition-colors ${
              listening
                ? 'bg-rose-500 text-white animate-pulse'
                : 'text-slate-400 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-white/10'
            }`}
          >
            {listening ? <MicOff size={16} /> : <Mic size={16} />}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}

      <div className="flex items-center gap-2 mt-3">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Fechar
          </button>
        )}
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="ml-auto px-4 py-1.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-60"
        >
          {submitting ? 'A guardar…' : tab === 'nota' ? 'Guardar nota' : 'Registar contacto'}
        </button>
      </div>
    </div>
  );
}
