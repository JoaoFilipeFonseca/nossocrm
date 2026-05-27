'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Save, Target, Calendar, Info, Scissors } from 'lucide-react';
import { Button } from '@/components/ui/button';

type Goal = {
  id?: string;
  year: number;
  annual_target_eur: number;
  monthly_target_eur: number[];
  notes: string | null;
  updated_at?: string;
};

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const emptyMonthly = (): number[] => Array.from({ length: 12 }, () => 0);

function makeEmptyGoal(year: number): Goal {
  return {
    year,
    annual_target_eur: 0,
    monthly_target_eur: emptyMonthly(),
    notes: '',
  };
}

function formatEur(n: number): string {
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('pt-PT', { maximumFractionDigits: 0 });
}

export const MetasSettings: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [year, setYear] = useState<number>(currentYear);
  const [draft, setDraft] = useState<Goal>(makeEmptyGoal(currentYear));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const sumMonthly = useMemo(
    () => draft.monthly_target_eur.reduce((acc, v) => acc + (Number.isFinite(v) ? v : 0), 0),
    [draft.monthly_target_eur],
  );

  const diff = draft.annual_target_eur - sumMonthly;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/settings/metas', { cache: 'no-store' });
        const json = await res.json();
        if (cancelled) return;
        setGoals(json.goals ?? []);
        setIsAdmin(Boolean(json.isAdmin));
        const existing = (json.goals as Goal[] | undefined)?.find((g) => g.year === year);
        setDraft(existing ?? makeEmptyGoal(year));
      } catch {
        if (!cancelled) setFeedback({ ok: false, msg: 'Erro a carregar metas.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const existing = goals.find((g) => g.year === year);
    setDraft(existing ?? makeEmptyGoal(year));
    setFeedback(null);
  }, [year, goals]);

  const setMonth = (idx: number, value: number) => {
    setDraft((d) => {
      const next = [...d.monthly_target_eur];
      next[idx] = Number.isFinite(value) ? Math.max(0, value) : 0;
      return { ...d, monthly_target_eur: next };
    });
  };

  const distributeEqual = () => {
    const per = Math.round((draft.annual_target_eur || 0) / 12);
    setDraft((d) => ({ ...d, monthly_target_eur: Array.from({ length: 12 }, () => per) }));
  };

  // Auto-distribui pelos 12 meses ao mudar a meta anual,
  // SÓ se os meses ainda estão todos a zero (não sobrescreve edições manuais).
  const setAnnualTarget = (value: number) => {
    setDraft((d) => {
      const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
      const allMonthsZero = d.monthly_target_eur.every((v) => !v || v === 0);
      const nextMonthly = allMonthsZero
        ? Array.from({ length: 12 }, () => Math.round(safeValue / 12))
        : d.monthly_target_eur;
      return { ...d, annual_target_eur: safeValue, monthly_target_eur: nextMonthly };
    });
  };

  // "Cortar o elefante às fatias": derivados motivadores
  const annual = draft.annual_target_eur || 0;
  const slices = {
    perMonth: annual / 12,
    perWeek: annual / 52,
    perWorkDay: annual / 252, // ~21 dias úteis × 12 meses
    perDayCalendar: annual / 365,
  };

  const clearMonthly = () => {
    setDraft((d) => ({ ...d, monthly_target_eur: emptyMonthly() }));
  };

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/settings/metas', {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          year: draft.year,
          annual_target_eur: Number(draft.annual_target_eur) || 0,
          monthly_target_eur: draft.monthly_target_eur.map((v) => Number(v) || 0),
          notes: draft.notes ?? null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setFeedback({ ok: false, msg: json.error || 'Erro a gravar.' });
      } else {
        setFeedback({ ok: true, msg: 'Meta gravada.' });
        // refresh
        const r2 = await fetch('/api/settings/metas', { cache: 'no-store' });
        const j2 = await r2.json();
        setGoals(j2.goals ?? []);
      }
    } catch (e) {
      setFeedback({ ok: false, msg: (e as Error).message || 'Erro a gravar.' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="pb-10">
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 text-sm text-slate-500">
          A carregar...
        </div>
      </div>
    );
  }

  const yearsAvailable = Array.from(new Set([currentYear, currentYear + 1, ...goals.map((g) => g.year)])).sort(
    (a, b) => b - a,
  );

  return (
    <div className="pb-10 space-y-6">
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
        <div className="flex items-start gap-3 mb-4">
          <Target className="h-5 w-5 text-primary-600 dark:text-primary-400 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Metas de receita</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
              Define a meta anual e a quebra mensal. É usada nas Métricas Honestas (Visão Geral) para o
              semáforo de gap à meta.
            </p>
          </div>
        </div>

        {!isAdmin && (
          <div className="text-sm text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-lg p-3 mb-4 flex gap-2">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>Apenas administradores podem editar. Está em modo só leitura.</span>
          </div>
        )}

        {/* Selector de ano */}
        <div className="mb-6 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Ano</span>
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-slate-400" />
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="rounded-md border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                {yearsAvailable.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </label>

          <label className="block flex-1 min-w-[220px]">
            <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Meta anual (€)</span>
            <input
              type="number"
              min={0}
              step={100}
              disabled={!isAdmin}
              placeholder="Ex: 120000"
              value={draft.annual_target_eur ? draft.annual_target_eur : ''}
              onChange={(e) => setAnnualTarget(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white disabled:opacity-60"
            />
          </label>

          {isAdmin && (
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={distributeEqual}>
                Distribuir igual
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={clearMonthly}>
                Limpar meses
              </Button>
            </div>
          )}
        </div>

        {/* Elefante às fatias — quebra motivadora */}
        {annual > 0 && (
          <div className="mb-5 p-4 rounded-xl bg-primary-50 dark:bg-primary-500/5 border border-primary-200 dark:border-primary-500/20">
            <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-primary-700 dark:text-primary-300">
              <Scissors className="h-4 w-4" />
              O elefante às fatias
              <span className="text-xs font-normal text-slate-500 dark:text-slate-400 ml-1">
                (assim assusta menos)
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-white/10">
                <div className="text-xs text-slate-500 dark:text-slate-400">Por mês</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{formatEur(slices.perMonth)} €</div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-white/10">
                <div className="text-xs text-slate-500 dark:text-slate-400">Por semana</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{formatEur(slices.perWeek)} €</div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-white/10">
                <div className="text-xs text-slate-500 dark:text-slate-400">Por dia útil</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{formatEur(slices.perWorkDay)} €</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">~21 dias × 12</div>
              </div>
              <div className="bg-white dark:bg-slate-900 rounded-lg p-3 border border-slate-200 dark:border-white/10">
                <div className="text-xs text-slate-500 dark:text-slate-400">Por dia (ano todo)</div>
                <div className="text-lg font-bold text-slate-900 dark:text-white tabular-nums">{formatEur(slices.perDayCalendar)} €</div>
              </div>
            </div>
          </div>
        )}

        {/* Grelha de meses */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
          {MESES.map((mes, idx) => (
            <label key={mes} className="block">
              <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">{mes}</span>
              <input
                type="number"
                min={0}
                step={100}
                disabled={!isAdmin}
                placeholder="0"
                value={draft.monthly_target_eur[idx] ? draft.monthly_target_eur[idx] : ''}
                onChange={(e) => setMonth(idx, Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white disabled:opacity-60"
              />
            </label>
          ))}
        </div>

        {/* Resumo soma mensal vs anual */}
        <div className="flex flex-wrap items-center justify-between gap-3 mt-4 p-3 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-sm">
          <div className="text-slate-600 dark:text-slate-300">
            Soma dos 12 meses: <strong>{formatEur(sumMonthly)} €</strong> ·
            Meta anual: <strong>{formatEur(draft.annual_target_eur || 0)} €</strong>
          </div>
          <div
            className={
              Math.abs(diff) < 1
                ? 'text-emerald-700 dark:text-emerald-400'
                : 'text-amber-700 dark:text-amber-300'
            }
          >
            {Math.abs(diff) < 1
              ? 'Equilibrado'
              : diff > 0
                ? `Faltam ${formatEur(diff)} € por distribuir`
                : `Excedem ${formatEur(-diff)} € a anual`}
          </div>
        </div>

        {/* Notas */}
        <label className="block mt-4">
          <span className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Notas (opcional)</span>
          <textarea
            rows={2}
            disabled={!isAdmin}
            value={draft.notes ?? ''}
            onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            placeholder="Ex: meta agressiva pós-renovação, ajustar Q3 se mercado piorar."
            className="w-full rounded-md border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-white disabled:opacity-60"
          />
        </label>

        {feedback && (
          <div
            className={`mt-4 text-sm rounded-lg p-3 ${
              feedback.ok
                ? 'bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                : 'bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300'
            }`}
          >
            {feedback.msg}
          </div>
        )}

        {isAdmin && (
          <div className="mt-4 flex justify-end">
            <Button type="button" onClick={save} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'A gravar...' : 'Gravar meta'}
            </Button>
          </div>
        )}
      </div>

      {/* Histórico */}
      {goals.length > 0 && (
        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Anos configurados</h4>
          <ul className="space-y-1 text-sm">
            {goals.map((g) => (
              <li key={g.year} className="flex justify-between text-slate-600 dark:text-slate-300">
                <span>{g.year}</span>
                <span>{formatEur(g.annual_target_eur)} €</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
