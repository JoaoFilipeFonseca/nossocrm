'use client';

/**
 * Ficha financeira por angariação (NS-1 Fase 4) — vive numa aba do detalhe do negócio.
 * Comissão em % OU € fixo + parte do consultor → menos custos atribuídos = ganho líquido real.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { Trash2, Plus } from 'lucide-react';

const CATEGORIES = [
  'Anúncios (fora do Facebook)', 'Combustível', 'Deslocações', 'Fotografia',
  'Home staging', 'Material', 'Inteligência Artificial', 'Outros',
] as const;

const eur = (cents: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const fmtDate = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };

interface Data {
  value_cents: number;
  commission_mode: 'pct' | 'fixed';
  commission_pct: number;
  commission_amount: number | null;
  consultant_share_pct: number;
  gross_commission_cents: number;
  net_commission_cents: number;
  expenses_cents: number;
  ganho_liquido_cents: number;
  margem: number | null;
  retorno: number | null;
  expenses: { id: string; spent_on: string; category: string; description: string | null; amount_cents: number }[];
}

export function DealFinanceCard({ dealId }: { dealId: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // campos editáveis da comissão
  const [mode, setMode] = useState<'pct' | 'fixed'>('pct');
  const [pct, setPct] = useState('');
  const [fixed, setFixed] = useState('');
  const [share, setShare] = useState('');

  // mini-form de despesa
  const [exDate, setExDate] = useState(todayISO());
  const [exCat, setExCat] = useState<string>(CATEGORIES[0]);
  const [exAmount, setExAmount] = useState('');
  const [exDesc, setExDesc] = useState('');

  const apply = useCallback((d: Data) => {
    setData(d);
    setMode(d.commission_mode);
    setPct(String(d.commission_pct ?? ''));
    setFixed(d.commission_amount != null ? String(d.commission_amount) : '');
    setShare(String(d.consultant_share_pct ?? ''));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/financeiro`, { cache: 'no-store' });
      if (res.ok) apply(await res.json());
    } finally {
      setLoading(false);
    }
  }, [dealId, apply]);

  useEffect(() => { void load(); }, [load]);

  const saveCommission = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/deals/${dealId}/financeiro`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commission_mode: mode,
          commission_pct: mode === 'pct' ? Number(pct.replace(',', '.')) || 0 : null,
          commission_amount: mode === 'fixed' ? Number(fixed.replace(',', '.')) || 0 : null,
          consultant_share_pct: Number(share.replace(',', '.')) || 0,
        }),
      });
      if (res.ok) apply(await res.json());
    } finally {
      setSaving(false);
    }
  };

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(exAmount.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) return;
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spent_on: exDate, category: exCat, amount: value, description: exDesc.trim() || null, deal_id: dealId }),
    });
    if (res.ok) { setExAmount(''); setExDesc(''); await load(); }
  };

  const delExpense = async (id: string) => {
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    if (res.ok) await load();
  };

  if (loading || !data) return <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">A carregar...</p>;

  const agencyCents = data.gross_commission_cents - data.net_commission_cents;
  const input = 'w-full rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white';
  const lbl = 'block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1';

  return (
    <div className="space-y-4">
      {/* Editor de comissão */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Comissão deste negócio</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">Venda: <b className="text-slate-900 dark:text-white">{eur(data.value_cents)}</b></span>
        </div>

        <div className="inline-flex gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-white/5">
          <button type="button" onClick={() => setMode('pct')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold ${mode === 'pct' ? 'bg-primary-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>
            Percentagem
          </button>
          <button type="button" onClick={() => setMode('fixed')}
            className={`px-3 py-1.5 rounded-md text-xs font-bold ${mode === 'fixed' ? 'bg-primary-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>
            Valor fixo (€)
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {mode === 'pct' ? (
            <div>
              <label className={lbl}>Comissão (% da venda)</label>
              <input inputMode="decimal" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="5" className={input} />
            </div>
          ) : (
            <div>
              <label className={lbl}>Comissão (€)</label>
              <input inputMode="decimal" value={fixed} onChange={(e) => setFixed(e.target.value)} placeholder="12500" className={input} />
            </div>
          )}
          <div>
            <label className={lbl}>A tua parte (%)</label>
            <input inputMode="decimal" value={share} onChange={(e) => setShare(e.target.value)} placeholder="50" className={input} />
          </div>
        </div>
        <button type="button" onClick={saveCommission} disabled={saving}
          className="text-sm font-bold text-primary-600 dark:text-primary-400 hover:underline disabled:opacity-50">
          {saving ? 'A guardar...' : 'Guardar comissão'}
        </button>
      </div>

      {/* Cálculo do ganho líquido real */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden">
        <Row k={`Comissão${data.commission_mode === 'pct' ? ` (${data.commission_pct}% da venda)` : ''}`} v={eur(data.gross_commission_cents)} />
        <Row k={`Parte da agência (${(100 - data.consultant_share_pct).toFixed(0)}%)`} v={`− ${eur(agencyCents)}`} minus />
        <Row k="A tua comissão líquida" v={eur(data.net_commission_cents)} />
        <Row k="Custos deste negócio" v={`− ${eur(data.expenses_cents)}`} minus />
        <div className="flex items-center justify-between px-4 py-3 bg-emerald-50 dark:bg-emerald-500/10">
          <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">Ganho líquido real</span>
          <span className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400">{eur(data.ganho_liquido_cents)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Mini label="Margem do negócio" value={data.margem == null ? '—' : `${(data.margem * 100).toFixed(1)}%`} />
        <Mini label="Retorno do investido" value={data.retorno == null ? '—' : `${data.retorno.toFixed(1)}×`} />
      </div>

      {/* Custos atribuídos + adicionar */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card p-4 space-y-3">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">Custos atribuídos a esta angariação</h3>
        <form onSubmit={addExpense} className="grid grid-cols-2 gap-2">
          <input type="date" value={exDate} onChange={(e) => setExDate(e.target.value)} className={input} />
          <select value={exCat} onChange={(e) => setExCat(e.target.value)} className={input}>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <input inputMode="decimal" value={exAmount} onChange={(e) => setExAmount(e.target.value)} placeholder="Valor (€)" className={input} />
          <input value={exDesc} onChange={(e) => setExDesc(e.target.value)} placeholder="Descrição (opcional)" className={input} />
          <button type="submit" className="col-span-2 inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-sm font-bold py-2">
            <Plus size={16} aria-hidden="true" /> Adicionar custo a este negócio
          </button>
        </form>
        <div className="divide-y divide-slate-100 dark:divide-white/5">
          {data.expenses.length === 0 ? (
            <p className="py-3 text-center text-sm text-slate-500 dark:text-slate-400">Sem custos atribuídos.</p>
          ) : data.expenses.map((e) => (
            <div key={e.id} className="flex items-center gap-3 py-2.5">
              <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">{e.category}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-900 dark:text-white truncate">{e.description || e.category}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{fmtDate(e.spent_on)}</p>
              </div>
              <span className="text-sm font-bold text-slate-900 dark:text-white">{eur(e.amount_cents)}</span>
              <button type="button" onClick={() => delExpense(e.id)} aria-label="Eliminar custo"
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
                <Trash2 size={15} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, minus }: { k: string; v: string; minus?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 dark:border-white/5">
      <span className="text-sm text-slate-500 dark:text-slate-400">{k}</span>
      <span className={`text-sm font-bold ${minus ? 'text-red-600 dark:text-red-400' : 'text-slate-900 dark:text-white'}`}>{v}</span>
    </div>
  );
}
function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 p-3 text-center">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{value}</div>
    </div>
  );
}
