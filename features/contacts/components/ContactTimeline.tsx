'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2 } from 'lucide-react';

export interface TimelineEntryDTO {
  id: string;
  type: string;
  description: string | null;
  at: string;
  manual: boolean;
  system: boolean;
  actor?: 'human' | 'automation' | 'system';
}

// PONTO 1 — distinção visível de quem originou o toque (humano vs automação).
const ACTOR_BADGE: Record<'human' | 'automation', { label: string; icon: string; cls: string }> = {
  human: { label: 'Você', icon: '👤', cls: 'bg-slate-100 dark:bg-white/10 text-slate-600 border-slate-200 dark:border-white/10' },
  automation: { label: 'Automação', icon: '🤖', cls: 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/20' },
};

interface ContactTimelineProps {
  contactId: string;
  initialEntries: TimelineEntryDTO[];
}

const TYPE_META: Record<string, { label: string; icon: string; cls: string }> = {
  call: { label: 'Chamada', icon: '📞', cls: 'bg-emerald-50 border-emerald-200 text-emerald-600' },
  whatsapp: { label: 'WhatsApp', icon: '💬', cls: 'bg-green-50 border-green-200 text-green-600' },
  email: { label: 'Email', icon: '📧', cls: 'bg-blue-50 border-blue-200 text-blue-600' },
  meeting: { label: 'Reunião', icon: '🤝', cls: 'bg-violet-50 border-violet-200 text-violet-600' },
  visit: { label: 'Visita', icon: '🏠', cls: 'bg-amber-50 border-amber-200 text-amber-600' },
  note: { label: 'Nota', icon: '📝', cls: 'bg-slate-50 border-slate-200 text-slate-600' },
  TASK: { label: 'Tarefa', icon: '📋', cls: 'bg-slate-50 border-slate-200 text-slate-600' },
  stage_moved: { label: 'Mudou de etapa', icon: '↗', cls: 'bg-slate-100 border-slate-200 text-slate-400' },
};

const FORM_TYPES = ['note', 'call', 'whatsapp', 'email', 'meeting', 'visit'] as const;

function meta(type: string) {
  return TYPE_META[type] ?? { label: type, icon: '•', cls: 'bg-slate-50 border-slate-200 text-slate-500' };
}

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' });
}

const inputCls = 'w-full bg-white dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500';

export function ContactTimeline({ contactId, initialEntries }: ContactTimelineProps) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<(typeof FORM_TYPES)[number]>('note');
  const [date, setDate] = React.useState('');
  const [time, setTime] = React.useState('');
  const [content, setContent] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busyDelete, setBusyDelete] = React.useState<string | null>(null);

  // Pré-preenche data/hora com o momento actual ao abrir o form.
  const openForm = () => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    setDate(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    setTime(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
    setContent('');
    setType('note');
    setError(null);
    setOpen(true);
  };

  const save = async () => {
    if (!content.trim()) { setError('Escreva o que aconteceu.'); return; }
    setSaving(true);
    setError(null);
    let occurredAt: string | undefined;
    if (date && time) {
      const d = new Date(`${date}T${time}`);
      if (!Number.isNaN(d.getTime())) occurredAt = d.toISOString();
    }
    try {
      const res = await fetch(`/api/contacts/${contactId}/activities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, description: content.trim(), occurredAt }),
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
            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tipo</label>
              <select className={inputCls} value={type} onChange={(e) => setType(e.target.value as (typeof FORM_TYPES)[number])}>
                {FORM_TYPES.map((t) => <option key={t} value={t}>{meta(t).icon} {meta(t).label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Data</label>
              <input type="date" className={inputCls} value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">Hora</label>
              <input type="time" className={inputCls} value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>
          <textarea rows={3} className={inputCls} value={content} onChange={(e) => setContent(e.target.value)} placeholder="Colar/escrever o conteúdo (ex.: email enviado pela conta RE/MAX)..." />
          {error && <p className="text-xs text-rose-600 mt-1">{error}</p>}
          <div className="flex items-center gap-2 mt-2">
            <button onClick={save} disabled={saving} className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-60">
              {saving ? 'A guardar...' : 'Guardar interacção'}
            </button>
            <button onClick={() => setOpen(false)} disabled={saving} className="px-3 py-1.5 rounded-lg text-sm font-medium text-slate-500">Cancelar</button>
            <span className="ml-auto text-[11px] text-slate-400 hidden sm:inline">A data/hora é editável para registar o passado.</span>
          </div>
        </div>
      )}

      {initialEntries.length === 0 ? (
        <p className="px-5 py-5 text-sm text-slate-400">Sem interacções registadas ainda.</p>
      ) : (
        <ol className="p-5 space-y-4">
          {initialEntries.map((e, i) => {
            const m = meta(e.type);
            const last = i === initialEntries.length - 1;
            return (
              <li key={e.id} className="flex gap-3 group">
                <div className="flex flex-col items-center">
                  <span className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm shrink-0 ${m.cls}`}>{m.icon}</span>
                  {!last && <span className="flex-1 w-px bg-slate-200 dark:bg-white/10 mt-1" />}
                </div>
                <div className="flex-1 -mt-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${e.system ? 'text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>{m.label}</span>
                    {e.actor && e.actor !== 'system' && (
                      <span className={`text-[11px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${ACTOR_BADGE[e.actor].cls}`}>
                        <span aria-hidden="true">{ACTOR_BADGE[e.actor].icon}</span> {ACTOR_BADGE[e.actor].label}
                      </span>
                    )}
                    <span className="ml-auto text-xs text-slate-400 shrink-0 flex items-center gap-2">
                      {fmt(e.at)}
                      {e.manual && (
                        // Sempre visível (mobile não tem hover); alvo de toque >=32px.
                        <button onClick={() => remove(e.id)} disabled={busyDelete === e.id} aria-label="Eliminar interacção" title="Eliminar registo" className="p-2 -m-2 text-slate-300 hover:text-rose-500 sm:opacity-40 sm:group-hover:opacity-100 transition-opacity disabled:opacity-30">
                          <Trash2 size={14} />
                        </button>
                      )}
                    </span>
                  </div>
                  {e.description
                    ? <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5 whitespace-pre-wrap break-words">{e.description}</p>
                    : e.system && <p className="text-[11px] text-slate-400 mt-0.5">automático</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
