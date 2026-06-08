'use client';

/**
 * Funil de Vendas (MKT-FUNNEL-CRM) — peça 1 do MKT-MEASURE.
 * Onde os negócios encalham, quanto tempo demoram e porque não fecham — só com
 * dados que o CRM já tem (board_stages, deal_activities.stage_moved, loss_reason).
 * Maqueta aprovada: docs/mockups/mkt-funnel-crm.html.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

type Board = { id: string; name: string; position: number };
type Stage = { stage_label: string; order: number; deals: number; pct: number };
type AvgTime = { stage_label: string; avg_days: number; samples: number };
type Loss = { reason: string; count: number; pct: number };
type Funnel = {
  kpis: { open_deals: number; open_value: number; won: number; lost: number; win_rate: number | null; avg_cycle_days: number | null };
  stages: Stage[];
  avg_time: AvgTime[];
  loss_reasons: Loss[];
};

type Period = '30d' | '12m' | 'all' | 'custom';

const eur = (n: number) =>
  new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n || 0);
const ymd = (d: Date) => d.toISOString().slice(0, 10);

function rangeFor(period: Period, from: string, to: string): { from: string | null; to: string | null } {
  const now = new Date();
  if (period === 'all') return { from: null, to: null };
  if (period === 'custom') return { from: from || null, to: to || null };
  const days = period === '30d' ? 30 : 365;
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: ymd(start), to: ymd(now) };
}

export function FunnelPage() {
  const [boards, setBoards] = useState<Board[]>([]);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>('12m');
  const [cFrom, setCFrom] = useState<string>(ymd(new Date(Date.now() - 365 * 864e5)));
  const [cTo, setCTo] = useState<string>(ymd(new Date()));
  const [data, setData] = useState<Funnel | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (bId: string | null, p: Period, f: string, t: string) => {
    setLoading(true); setErr(null);
    try {
      const { from, to } = rangeFor(p, f, t);
      const qs = new URLSearchParams();
      if (bId) qs.set('board_id', bId);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const res = await fetch(`/api/funnel?${qs.toString()}`, { credentials: 'same-origin' });
      const json = await res.json();
      if (json.error && !json.funnel) { setErr(json.error); setData(null); }
      else { setData(json.funnel as Funnel); }
      if (Array.isArray(json.boards)) setBoards(json.boards);
      if (json.board_id) setBoardId(json.board_id);
    } catch {
      setErr('Não foi possível carregar o funil.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(null, '12m', '', ''); /* arranque (12m ignora datas) */ }, [load]);

  const onBoard = (id: string) => { setBoardId(id); load(id, period, cFrom, cTo); };
  const onPeriod = (p: Period) => { setPeriod(p); if (p !== 'custom') load(boardId, p, cFrom, cTo); };
  const applyCustom = () => load(boardId, 'custom', cFrom, cTo);

  // Fugas entre etapas + maior buraco.
  const leaks = useMemo(() => {
    const s = data?.stages ?? [];
    const out: Array<{ passPct: number | null }> = [];
    let worst = -1, worstDrop = -1;
    for (let i = 0; i < s.length; i++) {
      const cur = s[i].deals, next = s[i + 1]?.deals;
      const passPct = i < s.length - 1 && cur > 0 ? Math.round((next / cur) * 100) : null;
      out.push({ passPct });
      if (passPct != null && cur > 0) {
        const drop = cur - next;
        if (drop > worstDrop) { worstDrop = drop; worst = i; }
      }
    }
    return { out, worst, worstDrop };
  }, [data]);

  const maxAvg = useMemo(() => Math.max(1, ...(data?.avg_time ?? []).map((a) => a.avg_days || 0)), [data]);
  const maxLoss = useMemo(() => Math.max(1, ...(data?.loss_reasons ?? []).map((l) => l.pct || 0)), [data]);
  const k = data?.kpis;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <header>
        <h1 className="text-xl font-bold font-display text-slate-900 dark:text-white">Funil de Vendas</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Onde os negócios encalham, quanto tempo demoram e porque não fecham.</p>
      </header>

      {/* Controlos */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          {boards.map((b) => (
            <button key={b.id} type="button" onClick={() => onBoard(b.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${boardId === b.id ? 'bg-primary-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>
              {b.name}
            </button>
          ))}
        </div>
        <div className="inline-flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          {([['30d', '30 dias'], ['12m', '12 meses'], ['all', 'Tudo'], ['custom', 'Personalizado']] as Array<[Period, string]>).map(([p, lbl]) => (
            <button key={p} type="button" onClick={() => onPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${period === p ? 'bg-primary-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>
              {lbl}
            </button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="inline-flex items-center gap-2">
            <label className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">De
              <input type="date" value={cFrom} onChange={(e) => setCFrom(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1 text-sm text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" />
            </label>
            <label className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1">Até
              <input type="date" value={cTo} onChange={(e) => setCTo(e.target.value)}
                className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1 text-sm text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" />
            </label>
            <button type="button" onClick={applyCustom} className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm font-semibold">Aplicar</button>
          </div>
        )}
      </div>

      {err && <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">{err}</div>}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Negócios no funil" value={loading ? '—' : String(k?.open_deals ?? 0)} sub={k ? `${eur(k.open_value)} em aberto` : ''} />
        <Kpi label="Taxa de fecho" value={loading ? '—' : k?.win_rate == null ? 's/ dados' : `${k.win_rate}%`} sub={k ? `${k.won} ganhos · ${k.lost} perdidos` : ''} />
        <Kpi label="Ciclo médio (ganho)" value={loading ? '—' : k?.avg_cycle_days == null ? 's/ dados' : `${k.avg_cycle_days} d`} sub="lead → fecho" />
        <Kpi label="Valor em aberto" value={loading ? '—' : eur(k?.open_value ?? 0)} sub={k ? `${k.open_deals} negócios` : ''} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_.9fr]">
        {/* Funil por etapa */}
        <Card title="📉 Funil por etapa" pill="conversão e fugas">
          {!boardId && <p className="text-sm text-slate-500 dark:text-slate-400">Escolhe um funil acima para ver as etapas.</p>}
          {(data?.stages ?? []).map((st, i) => (
            <div key={st.stage_label + i} className="my-2.5">
              <div className="flex justify-between text-[13.5px] mb-1">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{st.stage_label}</span>
                <span className="text-slate-500 dark:text-slate-400">{st.deals} · {st.pct}%</span>
              </div>
              <div className="h-8 rounded-lg bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 overflow-hidden relative">
                <span className={`block h-full ${i === (data?.stages.length ?? 0) - 1 ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`} style={{ width: `${Math.max(2, st.pct)}%` }} />
                <em className="absolute left-2.5 top-1.5 not-italic text-[13px] font-semibold text-white">{st.deals}</em>
              </div>
              {leaks.out[i]?.passPct != null && (
                <div className={`text-xs mt-1 ${leaks.worst === i ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                  {leaks.worst === i ? `↓ maior fuga: passam ${leaks.out[i].passPct}% (perdem-se ${leaks.worstDrop} negócios aqui)` : `passam ${leaks.out[i].passPct}%`}
                </div>
              )}
            </div>
          ))}
        </Card>

        <div className="grid gap-4 content-start">
          {/* Tempo por etapa */}
          <Card title="⏱️ Tempo médio em cada etapa">
            {(data?.avg_time ?? []).length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Ainda sem movimentos suficientes para medir.</p>}
            {(data?.avg_time ?? []).map((a, i) => (
              <div key={a.stage_label + i} className="flex items-center gap-2.5 my-2">
                <div className="w-28 shrink-0 text-[13px] text-slate-500 dark:text-slate-400 truncate" title={a.stage_label}>{a.stage_label}</div>
                <div className="flex-1 h-3.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 overflow-hidden">
                  <span className="block h-full" style={{ width: `${Math.round((a.avg_days / maxAvg) * 100)}%`, background: i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#3b82f6' }} />
                </div>
                <div className="w-20 text-right text-[13px] text-slate-700 dark:text-slate-200">
                  {a.avg_days} d{i === 0 && <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-500 border border-red-500/40">gargalo</span>}
                </div>
              </div>
            ))}
          </Card>

          {/* Motivos de perda */}
          <Card title="🚫 Porque não fecham" pill="motivos de perda">
            {(data?.loss_reasons ?? []).length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Sem negócios perdidos no período.</p>}
            {(data?.loss_reasons ?? []).map((l, i) => (
              <div key={l.reason + i} className="flex items-center gap-2.5 my-2">
                <div className="flex-1 text-[13.5px] text-slate-800 dark:text-slate-100">{l.reason}</div>
                <div className="w-28 h-3 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 overflow-hidden">
                  <span className="block h-full bg-gradient-to-r from-red-500 to-amber-500" style={{ width: `${Math.round((l.pct / maxLoss) * 100)}%` }} />
                </div>
                <div className="w-12 text-right text-[12.5px] text-slate-500 dark:text-slate-400">{l.pct}%</div>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500 border-t border-dashed border-slate-200 dark:border-white/10 pt-3">
        Calculado a partir de dados que o CRM já tem: etapas, movimentos reais dos negócios (stage_moved) e motivos de perda. Sem sensores externos.
      </p>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-3.5">
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-2xl font-bold text-slate-900 dark:text-white">{value}</div>
      {sub && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>}
    </div>
  );
}

function Card({ title, pill, children }: { title: string; pill?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[.03] p-4">
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
        {title}
        {pill && <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded-full">{pill}</span>}
      </h2>
      {children}
    </div>
  );
}
