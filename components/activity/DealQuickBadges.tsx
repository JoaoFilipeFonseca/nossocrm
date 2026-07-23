'use client';

import React from 'react';
import { Phone, Zap, CheckSquare, Radio, Clock } from 'lucide-react';
import { sourceLabel } from '@/lib/activities/sourceLabels';

interface DealQuickBadgesProps {
  manual?: number;
  auto?: number;
  tasks?: number;
  /** Canal de aquisição bruto (deal.attribution?.source ?? contact.source). */
  source?: string | null;
  /** Data de criação do negócio (para "Nd no pipeline"). */
  createdAt?: string | null;
  loading?: boolean;
  /** Versão mínima (só os 3 contadores) — para cartões do board. */
  compact?: boolean;
  className?: string;
}

function daysSince(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso).getTime();
  if (Number.isNaN(d)) return null;
  return Math.max(0, Math.floor((Date.now() - d) / 86_400_000));
}

const chip = 'inline-flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-md border';

export function DealQuickBadges({
  manual = 0,
  auto = 0,
  tasks = 0,
  source,
  createdAt,
  loading = false,
  compact = false,
  className = '',
}: DealQuickBadgesProps) {
  const days = daysSince(createdAt);
  const label = sourceLabel(source);

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400 ${className}`}>
        <span title="Contactos manuais">📞{manual}</span>
        <span title="Contactos automáticos">⚡{auto}</span>
        <span title="Tarefas em aberto">☑{tasks}</span>
      </span>
    );
  }

  return (
    <div className={`flex items-center gap-1.5 flex-wrap ${loading ? 'opacity-50' : ''} ${className}`}>
      <span className={`${chip} bg-slate-50 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10`} title="Contactos manuais (chamadas/mensagens que registou)">
        <Phone size={11} /> {manual} man
      </span>
      <span className={`${chip} bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-300 dark:border-indigo-500/20`} title="Contactos automáticos (feitos por automações)">
        <Zap size={11} /> {auto} auto
      </span>
      <span className={`${chip} bg-slate-50 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10`} title="Tarefas em aberto">
        <CheckSquare size={11} /> {tasks} tar
      </span>
      {label && (
        <span className={`${chip} bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20`} title="Canal de aquisição">
          <Radio size={11} /> {label}
        </span>
      )}
      {days !== null && (
        <span
          className={`${chip} ${
            days > 30
              ? 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/20'
              : days > 14
              ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/20'
              : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-white/5 dark:text-slate-300 dark:border-white/10'
          }`}
          title="Dias desde a criação do negócio"
        >
          <Clock size={11} /> {days}d no pipeline
        </span>
      )}
    </div>
  );
}
