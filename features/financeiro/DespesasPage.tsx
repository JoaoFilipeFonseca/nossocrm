'use client';

/**
 * Despesas — NS-1 Gestão Financeira (Fase 2).
 * Onde o consultor escreve o que gasta na profissão. Lista + formulário simples.
 * As contas (lucro, retorno) ficam na Visão de Gestor; aqui é só o registo.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Trash2, Plus, Receipt } from 'lucide-react';

const CATEGORIES = [
  'Combustível',
  'Deslocações',
  'Inteligência Artificial',
  'Software',
  'Fotografia',
  'Home staging',
  'Material',
  'Formação',
  'Anúncios (fora do Facebook)',
  'Refeições',
  'Estacionamento',
  'Quotas / AMI',
  'Seguros',
  'Outros',
] as const;

const CHIP: Record<string, string> = {
  'Combustível': 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10',
  'Deslocações': 'text-cyan-700 bg-cyan-50 dark:text-cyan-300 dark:bg-cyan-500/10',
  'Inteligência Artificial': 'text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-500/10',
  'Software': 'text-violet-700 bg-violet-50 dark:text-violet-300 dark:bg-violet-500/10',
  'Fotografia': 'text-fuchsia-700 bg-fuchsia-50 dark:text-fuchsia-300 dark:bg-fuchsia-500/10',
  'Home staging': 'text-teal-700 bg-teal-50 dark:text-teal-300 dark:bg-teal-500/10',
  'Anúncios (fora do Facebook)': 'text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-500/10',
  'Formação': 'text-emerald-700 bg-emerald-50 dark:text-emerald-300 dark:bg-emerald-500/10',
};
const chipClass = (c: string) => CHIP[c] ?? 'text-slate-600 bg-slate-100 dark:text-slate-300 dark:bg-white/10';

interface Expense {
  id: string;
  spent_on: string;
  category: string;
  description: string | null;
  amount_cents: number;
  deal_id: string | null;
  imovel_id: string | null;
  created_at: string;
}

const eur = (cents: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100);

const todayISO = () => {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
};

const fmtDate = (iso: string) => {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
};

export function DespesasPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [spentOn, setSpentOn] = useState(todayISO());
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/expenses', { cache: 'no-store' });
      const json = await res.json();
      setExpenses(Array.isArray(json.expenses) ? json.expenses : []);
    } catch {
      setError('Não foi possível carregar as despesas.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const total = useMemo(() => expenses.reduce((s, e) => s + e.amount_cents, 0), [expenses]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const value = Number(String(amount).replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) {
      setError('Escreve um valor válido (ex.: 18,40).');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spent_on: spentOn, category, amount: value, description: description.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok || !json.expense) {
        setError(json.message || 'Não foi possível guardar a despesa.');
        return;
      }
      setExpenses((prev) => [json.expense as Expense, ...prev]);
      setAmount('');
      setDescription('');
    } catch {
      setError('Não foi possível guardar a despesa.');
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: string) => {
    const prev = expenses;
    setExpenses((p) => p.filter((e) => e.id !== id));
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      if (!res.ok) setExpenses(prev);
    } catch {
      setExpenses(prev);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <header className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center">
          <Receipt size={20} aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-xl font-bold font-display text-slate-900 dark:text-white">Despesas</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Escreve aqui tudo o que gastas na profissão.</p>
        </div>
      </header>

      {/* Formulário */}
      <form
        onSubmit={onSubmit}
        className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card p-4 sm:p-5 space-y-3 shadow-sm"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Data</label>
            <input
              type="date"
              value={spentOn}
              onChange={(e) => setSpentOn(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Categoria</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Valor (€)</label>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="18,40"
              className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Descrição (opcional)</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ex.: combustível visita a Matosinhos"
              className="w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white font-bold py-2.5 text-sm transition-colors"
        >
          <Plus size={18} aria-hidden="true" />
          {saving ? 'A guardar...' : 'Adicionar despesa'}
        </button>
      </form>

      {/* Total */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-4 py-3">
        <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total registado</span>
        <span className="text-lg font-bold text-slate-900 dark:text-white">{eur(total)}</span>
      </div>

      {/* Lista */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card shadow-sm divide-y divide-slate-100 dark:divide-white/5">
        {loading ? (
          <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">A carregar...</p>
        ) : expenses.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Ainda não há despesas. Escreve a primeira acima.
          </p>
        ) : (
          expenses.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-3">
              <span className={`shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full ${chipClass(e.category)}`}>
                {e.category}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                  {e.description || e.category}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{fmtDate(e.spent_on)}</p>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white whitespace-nowrap">{eur(e.amount_cents)}</span>
              <button
                type="button"
                onClick={() => onDelete(e.id)}
                aria-label="Eliminar despesa"
                className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={16} aria-hidden="true" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
