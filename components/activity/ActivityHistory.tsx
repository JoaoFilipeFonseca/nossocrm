'use client';

import React from 'react';
import { Trash2 } from 'lucide-react';
import {
  channelMeta,
  ACTOR_BADGE,
  RESULT_META,
  RESULT_TONE_CLS,
} from '@/lib/activities/vocab';

export interface ActivityEntry {
  id: string;
  type: string;
  description: string | null;
  at: string;
  manual: boolean;
  system: boolean;
  actor?: 'human' | 'automation' | 'system';
  result?: string | null;
}

interface ActivityHistoryProps {
  entries: ActivityEntry[];
  onDelete?: (id: string) => void;
  busyDeleteId?: string | null;
  /** Título opcional (ex.: "Histórico (3)"). */
  heading?: string;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('pt-PT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Lisbon',
  });
}

export function ActivityHistory({ entries, onDelete, busyDeleteId, heading }: ActivityHistoryProps) {
  if (entries.length === 0) {
    return <p className="px-1 py-4 text-sm text-slate-400">Sem interacções registadas ainda.</p>;
  }

  return (
    <div>
      {heading && (
        <h3 className="text-xs font-bold text-slate-500 uppercase mb-3">{heading}</h3>
      )}
      <ol className="space-y-4">
        {entries.map((e, i) => {
          const m = channelMeta(e.type);
          const last = i === entries.length - 1;
          const resultMeta = e.result ? RESULT_META[e.result] : null;
          return (
            <li key={e.id} className="flex gap-3 group">
              <div className="flex flex-col items-center">
                <span className={`w-8 h-8 rounded-full border flex items-center justify-center text-sm shrink-0 ${m.cls}`}>
                  {m.icon}
                </span>
                {!last && <span className="flex-1 w-px bg-slate-200 dark:bg-white/10 mt-1" />}
              </div>
              <div className="flex-1 -mt-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-sm font-semibold ${e.system ? 'text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
                    {m.label}
                  </span>
                  {resultMeta && (
                    <span className={`text-[11px] px-1.5 py-0.5 rounded border ${RESULT_TONE_CLS[resultMeta.tone]}`}>
                      {resultMeta.label}
                    </span>
                  )}
                  {e.actor && e.actor !== 'system' && (
                    <span className={`text-[11px] px-1.5 py-0.5 rounded border inline-flex items-center gap-1 ${ACTOR_BADGE[e.actor].cls}`}>
                      <span aria-hidden="true">{ACTOR_BADGE[e.actor].icon}</span> {ACTOR_BADGE[e.actor].label}
                    </span>
                  )}
                  <span className="ml-auto text-xs text-slate-400 shrink-0 flex items-center gap-2">
                    {fmt(e.at)}
                    {e.manual && onDelete && (
                      <button
                        onClick={() => onDelete(e.id)}
                        disabled={busyDeleteId === e.id}
                        aria-label="Eliminar interacção"
                        title="Eliminar registo"
                        className="p-2 -m-2 text-slate-300 hover:text-rose-500 sm:opacity-40 sm:group-hover:opacity-100 transition-opacity disabled:opacity-30"
                      >
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
    </div>
  );
}
