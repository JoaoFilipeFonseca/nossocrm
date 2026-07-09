'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { Phone, RefreshCw, Copy, Check, PhoneOff, CalendarCheck, PhoneCall } from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import type { PowerListItem, PowerListPayload, PowerListBucket, Semaphore } from '@/lib/power-list/types';

const BUCKET_META: Record<PowerListBucket, { label: string; cls: string }> = {
  lead_nova: { label: 'Lead nova', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  followup: { label: 'Seguimento', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  reactivacao: { label: 'Reactivação', cls: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
};

const SEM: Record<Semaphore, { dot: string; bar: string; label: string; text: string }> = {
  green: { dot: 'bg-emerald-500', bar: 'bg-emerald-500', label: 'No bom caminho', text: 'text-emerald-600 dark:text-emerald-400' },
  amber: { dot: 'bg-amber-500', bar: 'bg-amber-500', label: 'A meio da meta', text: 'text-amber-600 dark:text-amber-400' },
  red: { dot: 'bg-red-500', bar: 'bg-red-500', label: 'Abaixo do ritmo', text: 'text-red-600 dark:text-red-400' },
};

type CallResult = { type: 'call' | 'meeting'; result: string; label: string; icon: React.ComponentType<{ size?: number; className?: string }> };
const RESULTS: CallResult[] = [
  { type: 'call', result: 'answered', label: 'Atendeu', icon: PhoneCall },
  { type: 'call', result: 'no_answer', label: 'Não atendeu', icon: PhoneOff },
  { type: 'meeting', result: 'meeting', label: 'Marcou reunião', icon: CalendarCheck },
];

function telHref(phone: string | null): string {
  if (!phone) return '';
  const c = phone.replace(/[^\d+]/g, '');
  return c ? `tel:${c}` : '';
}

export const HojePage: React.FC = () => {
  const { addToast } = useToast();
  const [payload, setPayload] = useState<PowerListPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/power-list', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro a carregar a lista');
      setPayload(data as PowerListPayload);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const logCall = async (item: PowerListItem, r: CallResult) => {
    setBusy(item.dealId);
    try {
      const res = await fetch(`/api/deals/${encodeURIComponent(item.dealId)}/activities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: r.type,
          description: r.result === 'meeting' ? 'Reunião marcada a partir da Power List' : null,
          metadata: { via: 'power-list', result: r.result },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(data.error || 'Erro a registar', 'error');
        return;
      }
      addToast(`✓ ${r.label} — ${item.contactName}`, 'success');
      // Tira o item da lista e sobe o número do dia (call/meeting = conversa).
      setPayload((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((it) => it.dealId !== item.dealId),
              numeroDoDia: { ...prev.numeroDoDia, conversasSemana: prev.numeroDoDia.conversasSemana + 1 },
            }
          : prev,
      );
      setExpanded(null);
    } catch (e) {
      addToast((e as Error).message || 'Erro de rede', 'error');
    } finally {
      setBusy(null);
    }
  };

  const copyLine = async (item: PowerListItem) => {
    try {
      await navigator.clipboard.writeText(item.openingLine);
      setCopied(item.dealId);
      setTimeout(() => setCopied((c) => (c === item.dealId ? null : c)), 1500);
    } catch {
      addToast('Não foi possível copiar', 'error');
    }
  };

  const nd = payload?.numeroDoDia;
  const pct = nd ? Math.min(100, Math.round((nd.conversasSemana / Math.max(1, nd.meta)) * 100)) : 0;
  const sem = nd ? SEM[nd.semaphore] : SEM.red;

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 sm:py-8 sm:px-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display text-slate-900 dark:text-white">Hoje</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            A sua Power List. Os contactos a ligar agora, por prioridade.
          </p>
        </div>
        <button
          onClick={() => void load()}
          disabled={loading}
          className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} /> Atualizar
        </button>
      </div>

      {/* Número do dia */}
      {nd && (
        <div className="mb-6 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">O número do dia</div>
              <div className="mt-1 text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <span className={`inline-block h-2.5 w-2.5 rounded-full ${sem.dot}`} />
                {nd.conversasSemana} de {nd.meta} conversas esta semana
              </div>
            </div>
            <div className={`text-sm font-semibold ${sem.text}`}>{sem.label}</div>
          </div>
          <div className="mt-3 h-2 w-full rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
            <div className={`h-full rounded-full ${sem.bar} transition-all`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {/* Estados */}
      {loading && !payload && (
        <div className="py-16 text-center text-slate-400 text-sm">A montar a sua lista…</div>
      )}
      {error && !loading && (
        <div className="py-10 text-center">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <button onClick={() => void load()} className="mt-3 text-sm text-primary-600 hover:underline">Tentar de novo</button>
        </div>
      )}
      {!loading && !error && payload && payload.items.length === 0 && (
        <div className="py-16 text-center">
          <div className="text-4xl mb-3">✅</div>
          <p className="text-slate-700 dark:text-slate-200 font-medium">Lista limpa por hoje.</p>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Marcou todos os contactos. Bom trabalho.</p>
        </div>
      )}

      {/* Lista */}
      {payload && payload.items.length > 0 && (
        <ul className="space-y-3">
          {payload.items.map((item, i) => {
            const bm = BUCKET_META[item.bucket] ?? BUCKET_META.reactivacao;
            const tel = telHref(item.phone);
            const isOpen = expanded === item.dealId;
            const isBusy = busy === item.dealId;
            return (
              <li
                key={item.dealId}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-base font-semibold text-slate-900 dark:text-white">
                        {i + 1}. {item.contactName}
                      </span>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${bm.cls}`}>{bm.label}</span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-x-2 gap-y-0.5">
                      {item.boardName && <span>{item.boardName}</span>}
                      {item.source && <span>· {item.source}</span>}
                      {item.daysIdle != null && <span>· há {item.daysIdle} dias</span>}
                    </div>
                  </div>
                  {item.phone && (
                    <a
                      href={tel || undefined}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary-600 hover:bg-primary-500 text-white text-sm font-medium"
                    >
                      <Phone size={15} /> <span className="hidden sm:inline">{item.phone}</span>
                    </a>
                  )}
                </div>

                <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{item.reason}</p>

                {/* Primeira frase */}
                <div className="mt-3 flex items-start gap-2 rounded-lg border-l-2 border-primary-500 bg-slate-50 dark:bg-white/5 pl-3 pr-2 py-2">
                  <p className="flex-1 text-sm italic text-slate-800 dark:text-slate-100 leading-relaxed">
                    {item.openingLine}
                  </p>
                  <button
                    onClick={() => void copyLine(item)}
                    title="Copiar frase"
                    className="flex-shrink-0 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1"
                  >
                    {copied === item.dealId ? <Check size={15} className="text-emerald-500" /> : <Copy size={15} />}
                  </button>
                </div>

                {/* Liguei */}
                <div className="mt-3">
                  {!isOpen ? (
                    <button
                      onClick={() => setExpanded(item.dealId)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                    >
                      <PhoneCall size={15} /> Liguei
                    </button>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {RESULTS.map((r) => (
                        <button
                          key={r.result}
                          onClick={() => void logCall(item, r)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-sm text-slate-700 dark:text-slate-200 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 disabled:opacity-50"
                        >
                          <r.icon size={15} className="text-primary-500" /> {r.label}
                        </button>
                      ))}
                      <button
                        onClick={() => setExpanded(null)}
                        disabled={isBusy}
                        className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 px-2 disabled:opacity-50"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};
