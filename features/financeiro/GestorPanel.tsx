'use client';

/**
 * Visão de Gestor — NS-1 Fase 3.
 * Comissões líquidas vs investimento (anúncios + despesas) → lucro, margem, retorno,
 * e a repartição "para onde foi o dinheiro". Período seleccionável.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

interface Summary {
  comissoes_liquidas_cents: number;
  investimento_cents: number;
  ads_cents: number;
  despesas_cents: number;
  lucro_cents: number;
  margem: number | null;
  retorno: number | null;
  won_count: number;
  leads: number;
  custo_por_lead_cents: number | null;
  breakdown: { label: string; cents: number }[];
}

const eur = (cents: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

type PeriodKey = 'mes' | 'ano' | 'sempre';

const BAR_COLORS = ['#2563eb', '#d97706', '#0891b2', '#7c3aed', '#475569', '#059669', '#db2777', '#0ea5e9'];

export function GestorPanel() {
  const [period, setPeriod] = useState<PeriodKey>('ano');
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    const now = new Date();
    if (period === 'mes') return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(now) };
    if (period === 'ano') return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(now) };
    return { from: null, to: null };
  }, [period]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams();
      if (range.from) qs.set('from', range.from);
      if (range.to) qs.set('to', range.to);
      const res = await fetch(`/api/financeiro/summary?${qs.toString()}`, { cache: 'no-store' });
      setData(await res.json());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { void load(); }, [load]);

  const totalCost = data?.investimento_cents ?? 0;

  return (
    <div className="space-y-5">
      {/* Período */}
      <div className="flex gap-2">
        {([['mes', 'Este mês'], ['ano', 'Este ano'], ['sempre', 'Sempre']] as [PeriodKey, string][]).map(([k, label]) => (
          <button
            key={k}
            type="button"
            onClick={() => setPeriod(k)}
            className={`px-3 py-1.5 rounded-lg text-sm font-semibold border transition-colors ${
              period === k
                ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white'
                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-white/10'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading || !data ? (
        <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">A carregar...</p>
      ) : (
        <>
          {/* KPIs grandes */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Kpi color="#059669" label="Comissões líquidas" value={eur(data.comissoes_liquidas_cents)}
              hint={`${data.won_count} ${data.won_count === 1 ? 'negócio fechado' : 'negócios fechados'}`} tint="green" />
            <Kpi color="#dc2626" label="Investimento total" value={eur(data.investimento_cents)}
              hint="anúncios + despesas" />
            <Kpi color="#2563eb" label="Lucro líquido" value={eur(data.lucro_cents)}
              hint="comissões − investimento" tint="blue" />
            <Kpi color="#0f172a" label="Margem" value={data.margem == null ? '—' : `${(data.margem * 100).toFixed(1)}%`}
              hint="do que entra, fica" />
            <Kpi color="#059669" label="Retorno" value={data.retorno == null ? '—' : `${data.retorno.toFixed(1)}×`}
              hint="por cada 1 € investido" />
          </div>

          {/* KPIs pequenos */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi small label="Anúncios (Facebook)" value={eur(data.ads_cents)} hint="automático" />
            <Kpi small label="Despesas" value={eur(data.despesas_cents)} hint="o que escreveste" />
            <Kpi small label="Leads de anúncios" value={String(data.leads)} hint="reportadas pelo Meta" />
            <Kpi small label="Custo por lead" value={data.custo_por_lead_cents == null ? '—' : eur(data.custo_por_lead_cents)} hint="anúncios ÷ leads" />
          </div>

          {/* Para onde foi o dinheiro */}
          <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card p-5 shadow-sm">
            <h2 className="text-base font-bold font-display text-slate-900 dark:text-white">Para onde foi o dinheiro</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Repartição do investimento neste período</p>
            {totalCost === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Ainda não há investimento registado neste período.</p>
            ) : (
              <>
                <div className="flex h-3.5 rounded-full overflow-hidden border border-slate-200 dark:border-white/10">
                  {data.breakdown.map((b, i) => (
                    <span key={b.label} style={{ width: `${(b.cents / totalCost) * 100}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
                  ))}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
                  {data.breakdown.map((b, i) => (
                    <div key={b.label} className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className="w-2 h-2 rounded-full" style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />
                      {b.label} <b className="text-slate-900 dark:text-white">{eur(b.cents)}</b>
                    </div>
                  ))}
                </div>
              </>
            )}
            <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-4 leading-relaxed">
              Os anúncios do Facebook entram sozinhos. As outras despesas são as que escreves no separador Despesas.
              Cada despesa pode ser ligada a uma angariação para saberes o lucro real de cada negócio.
            </p>
          </div>

          <FunnelSection />
        </>
      )}
    </div>
  );
}

interface FunnelStage { label: string; reached: number; pct_total: number; conv_prev: number | null }
interface FunnelData { boards: { id: string; name: string }[]; board_id: string | null; total: number; won_count: number; won_value_cents: number; stages: FunnelStage[] }

function FunnelSection() {
  const [data, setData] = useState<FunnelData | null>(null);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (bid: string | null) => {
    setLoading(true);
    try {
      const qs = bid ? `?board_id=${bid}` : '';
      const res = await fetch(`/api/financeiro/funnel${qs}`, { cache: 'no-store' });
      const json: FunnelData = await res.json();
      setData(json);
      if (!bid) setBoardId(json.board_id);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(null); }, [load]);

  const onBoard = (id: string) => { setBoardId(id); void load(id); };
  const max = data && data.stages.length ? Math.max(1, ...data.stages.map((s) => s.reached)) : 1;

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-1">
        <h2 className="text-base font-bold font-display text-slate-900 dark:text-white">Funil — de negócio a fechado</h2>
        {data && data.boards.length > 0 && (
          <select
            value={boardId ?? ''}
            onChange={(e) => onBoard(e.target.value)}
            className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"
          >
            {data.boards.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        )}
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Quantos negócios chegaram a cada etapa, e a conversão entre etapas (estado actual do pipeline)</p>

      {loading || !data ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">A carregar...</p>
      ) : data.stages.length === 0 || data.total === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Ainda não há negócios neste pipeline.</p>
      ) : (
        <div className="space-y-2.5">
          {data.stages.map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div
                  className="h-9 rounded-lg flex items-center px-3 text-white text-sm font-bold whitespace-nowrap overflow-hidden"
                  style={{
                    width: `${Math.max(18, (s.reached / max) * 100)}%`,
                    background: `hsl(217, 90%, ${Math.max(38, 62 - i * 5)}%)`,
                  }}
                >
                  {s.reached} · {s.label}
                </div>
              </div>
              <div className="w-28 shrink-0 text-xs text-slate-500 dark:text-slate-400">
                {i === 0
                  ? `${(s.pct_total * 100).toFixed(0)}% do total`
                  : s.conv_prev == null ? '—' : `${(s.conv_prev * 100).toFixed(0)}% da anterior`}
              </div>
            </div>
          ))}
          <div className="flex items-center gap-3 pt-1">
            <div className="flex-1">
              <div className="h-9 rounded-lg flex items-center px-3 bg-emerald-600 text-white text-sm font-bold"
                style={{ width: `${Math.max(18, (data.won_count / max) * 100)}%` }}>
                {data.won_count} fechados{data.won_value_cents > 0 ? ` · ${eur(data.won_value_cents)}` : ''}
              </div>
            </div>
            <div className="w-28 shrink-0 text-xs text-slate-500 dark:text-slate-400">
              {data.total > 0 ? `${((data.won_count / data.total) * 100).toFixed(1)}% conversão total` : '—'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, tint, small }: {
  label: string; value: string; hint?: string; color?: string; tint?: 'green' | 'blue'; small?: boolean;
}) {
  const bg = tint === 'green'
    ? 'bg-gradient-to-b from-emerald-50 to-white dark:from-emerald-500/5 dark:to-transparent'
    : tint === 'blue'
      ? 'bg-gradient-to-b from-blue-50 to-white dark:from-blue-500/5 dark:to-transparent border-blue-200 dark:border-blue-900/40'
      : 'bg-white dark:bg-dark-card';
  const valColor = tint === 'green' ? 'text-emerald-600 dark:text-emerald-400'
    : tint === 'blue' ? 'text-primary-600 dark:text-primary-400'
    : 'text-slate-900 dark:text-white';
  return (
    <div className={`rounded-2xl border border-slate-200 dark:border-white/10 p-4 shadow-sm ${bg}`}>
      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{label}</div>
      <div className={`font-bold tracking-tight mt-1.5 ${small ? 'text-lg' : 'text-2xl'} ${valColor}`}>{value}</div>
      {hint && <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">{hint}</div>}
    </div>
  );
}
