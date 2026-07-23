'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Mic, MicOff } from 'lucide-react';
import { ActivityHistory, type ActivityEntry } from '@/components/activity/ActivityHistory';
import { CHANNELS, RESULTS, CHANNEL_META, RESULT_META, type Channel, type Result } from '@/lib/activities/vocab';
import { useDictation } from '@/lib/activities/useDictation';

export type TimelineEntryDTO = ActivityEntry;

interface ContactTimelineProps {
  contactId: string;
  initialEntries: TimelineEntryDTO[];
}

// Canais + Nota. A nota não tem resultado.
const FORM_TYPES = ['note', ...CHANNELS] as const;
type FormType = (typeof FORM_TYPES)[number];

const inputCls =
  'w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500';

function formTypeLabel(t: FormType): { icon: string; label: string } {
  if (t === 'note') return { icon: '📝', label: 'Nota' };
  return { icon: CHANNEL_META[t].icon, label: CHANNEL_META[t].label };
}

export function ContactTimeline({ contactId, initialEntries }: ContactTimelineProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<FormType>('note');
  const [result, setResult] = React.useState<Result | ''>('');
  const [date, setDate] = React.useState('');
  const [time, setTime] = React.useState('');
  const [content, setContent] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyDelete, setBusyDelete] = React.useState<string | null>(null);

  const appendDictated = React.useCallback((text: string) => {
    setContent((prev) => (prev ? `${prev} ${text}` : text));
  }, []);
  const { supported: micSupported, listening, toggle } = useDictation(appendDictated);

  // Pré-preenche data/hora com o momento actual ao abrir o form.
  const openForm = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    setDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    setTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
    setContent('');
    setType('note');
    setResult('');
    setError(null);
    setOpen(true);
  };

  const isNote = type === 'note';

  const save = async () => {
    setError(null);
    if (isNote && !content.trim()) { setError('Escreva o que aconteceu.'); return; }
    if (!isNote && !result) { setError('Escolha o resultado.'); return; }
    setSaving(true);
    let occurredAt: string | undefined;
    if (date && time) {
      const d = new Date(`${date}T${time}`);
      if (!Number.isNaN(d.getTime())) occurredAt = d.toISOString();
    }
    try {
      const res = await fetch(`/api/contacts/${contactId}/activities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type,
          description: content.trim() || null,
          result: isNote ? null : result,
          occurredAt,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error || 'Falha ao registar.');
      }
      setOpen(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao registar.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setBusyDelete(id);
    try {
      await fetch(`/api/contacts/${contactId}/activities?activityId=${id}`, { method: 'DELETE' });
      router.refresh();
    } finally {
      setBusyDelete(null);
    }
  };

  return (
    <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
      <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Histórico de interacções</h2>
          <span className="text-[11px] text-slate-400 hidden sm:inline">tudo ligado a esta pessoa</span>
        </div>
        {!open && (
          <button onClick={openForm} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-500 shrink-0">
            <Plus size={15} /> Registar
          </button>
        )}
      </div>

      {/* Form de registo manual */}
      {open && (
        <div className="p-4 bg-slate-50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2">
            <div className={isNote ? 'col-span-2' : ''}>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Canal</label>
              <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as FormType)}>
                {FORM_TYPES.map((t) => {
                  const m = formTypeLabel(t);
                  return <option key={t} value={t}>{m.icon} {m.label}</option>;
                })}
              </select>
            </div>
            {!isNote && (
              <div className="col-span-2 sm:col-span-2">
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Resultado</label>
                <select className={inputCls} value={result} onChange={(e) => setResult(e.target.value as Result | '')}>
                  <option value="" disabled>— escolher —</option>
                  {RESULTS.map((r) => <option key={r} value={r}>{RESULT_META[r].label}</option>)}
                </select>
              </div>
            )}
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Data</label>
              <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Hora</label>
              <input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <div className="relative">
            <textarea
              rows={3}
              className={`${inputCls} ${micSupported ? 'pr-10' : ''}`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={isNote ? 'Escreva a nota…' : 'O que se falou? (opcional — texto ou microfone)'}
            />
            {micSupported && (
              <button
                type="button"
                onClick={toggle}
                aria-label={listening ? 'Parar ditado' : 'Ditar por voz'}
                title={listening ? 'Parar ditado' : 'Ditar por voz'}
                className={`absolute right-2 top-2 p-1.5 rounded-md transition-colors ${
                  listening ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-400 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-white/10'
                }`}
              >
                {listening ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
            )}
          </div>
          {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
          <div className="flex items-center gap-2 mt-2">
            <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-60">
              {saving ? 'A guardar...' : isNote ? 'Guardar nota' : 'Registar contacto'}
            </button>
            <button onClick={() => setOpen(false)} disabled={saving} className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500">Cancelar</button>
            <span className="ml-auto text-[11px] text-slate-400 hidden sm:inline">A data/hora é editável para registar o passado.</span>
          </div>
        </div>
      )}

      <div className="p-5">
        <ActivityHistory entries={initialEntries} onDelete={remove} busyDeleteId={busyDelete} />
      </div>
    </div>
  );
}
