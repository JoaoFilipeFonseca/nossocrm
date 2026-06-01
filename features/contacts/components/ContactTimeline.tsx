'use client';

import React from 'react';

export interface TimelineEntryDTO {
  id: string;
  type: string;
  description: string | null;
  at: string;
  manual: boolean;
  system: boolean;
}

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

function meta(type: string) {
  return TYPE_META[type] ?? { label: type, icon: '•', cls: 'bg-slate-50 border-slate-200 text-slate-500' };
}

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-PT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' });
}

export function ContactTimeline({ contactId: _contactId, initialEntries }: ContactTimelineProps) {
  const entries = initialEntries;

  return (
    <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
      <div className="px-5 py-3 flex items-center justify-between border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Histórico de interações</h2>
          <span className="text-[11px] text-slate-400">tudo ligado a esta pessoa</span>
        </div>
      </div>

      {entries.length === 0 ? (
        <p className="px-5 py-5 text-sm text-slate-400">Sem interações registadas ainda.</p>
      ) : (
        <ol className="p-5 space-y-4">
          {entries.map((e, i) => {
            const m = meta(e.type);
            const last = i === entries.length - 1;
            return (
              <li key={e.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm shrink-0 ${m.cls}`}>{m.icon}</span>
                  {!last && <span className="flex-1 w-px bg-slate-200 dark:bg-white/10 mt-1" />}
                </div>
                <div className="flex-1 -mt-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${e.system ? 'text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>{m.label}</span>
                    {e.manual && <span className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-white/10 text-slate-500 border border-slate-200 dark:border-white/10">manual</span>}
                    <span className="ml-auto text-xs text-slate-400 shrink-0">{fmt(e.at)}</span>
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
