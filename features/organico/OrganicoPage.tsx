'use client';

/**
 * Orgânico — Página (MKT-ORGANIC-INSIGHTS). Posts não pagos da Página: melhores
 * publicações, interacção ao longo do tempo e por tipo. Leitura ao vivo da Graph
 * (reusa a ligação Meta). Alcance do Instagram = reach único do período
 * (metric_type=total_value, ≤30d), validado contra o Meta Business Suite.
 * Maqueta aprovada: docs/mockups/mkt-organic-insights.html.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';

type Post = { id: string; message: string; created_time: string; permalink: string | null; media_type: string; reactions: number; comments: number; shares: number; interactions: number };
type Summary = {
  kpis: { posts: number; interactions: number; avg: number };
  top: Post[];
  timeline: Array<{ label: string; value: number }>;
  by_type: Array<{ type: string; label: string; value: number }>;
  reach: number | null;
  reach_available: boolean;
};
type Period = '30d' | '90d' | '12m' | 'custom';
type Network = 'facebook' | 'instagram';

const ymd = (d: Date) => d.toISOString().slice(0, 10);
const nf = (n: number) => new Intl.NumberFormat('pt-PT').format(n || 0);
const TYPE_EMOJI: Record<string, string> = { photo: '📸', video: '🎥', link: '🔗', status: '📝', album: '🖼️', share: '↗️', event: '📅' };

function rangeFor(p: Period, f: string, t: string): { from: string | null; to: string | null } {
  const now = new Date();
  if (p === 'custom') return { from: f || null, to: t || null };
  const days = p === '30d' ? 30 : p === '90d' ? 90 : 365;
  return { from: ymd(new Date(now.getTime() - days * 864e5)), to: ymd(now) };
}

export function OrganicoPage() {
  const [period, setPeriod] = useState<Period>('90d');
  const [network, setNetwork] = useState<Network>('facebook');
  const [cFrom, setCFrom] = useState(ymd(new Date(Date.now() - 90 * 864e5)));
  const [cTo, setCTo] = useState(ymd(new Date()));
  const [data, setData] = useState<Summary | null>(null);
  const [reachWin, setReachWin] = useState<{ clamped: boolean; days: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (net: Network, p: Period, f: string, t: string) => {
    setLoading(true); setErr(null);
    try {
      const { from, to } = rangeFor(p, f, t);
      const qs = new URLSearchParams({ network: net });
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const res = await fetch(`/api/organico?${qs.toString()}`, { credentials: 'same-origin' });
      const json = await res.json();
      if (json.summary) setData(json.summary as Summary);
      else { setData(null); }
      setReachWin(json.reach_window ?? null);
      if (json.error) setErr(json.message || json.error);
    } catch {
      setErr('Não foi possível carregar o orgânico.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load('facebook', '90d', '', ''); }, [load]);

  const onNet = (n: Network) => { setNetwork(n); load(n, period, cFrom, cTo); };
  const onPeriod = (p: Period) => { setPeriod(p); if (p !== 'custom') load(network, p, cFrom, cTo); };

  const maxTl = useMemo(() => Math.max(1, ...(data?.timeline ?? []).map((x) => x.value)), [data]);
  const maxType = useMemo(() => Math.max(1, ...(data?.by_type ?? []).map((x) => x.value)), [data]);
  const k = data?.kpis;
  const best = data?.top?.[0];

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <header>
        <h1 className="text-xl font-bold font-display text-slate-900 dark:text-white">Orgânico — Página</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Os teus posts não pagos: o que publicas, o que gera interacção e os que mais resultam.</p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          {([['facebook', 'Facebook'], ['instagram', 'Instagram']] as Array<[Network, string]>).map(([n, lbl]) => (
            <button key={n} type="button" onClick={() => onNet(n)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${network === n ? 'bg-primary-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{lbl}</button>
          ))}
        </div>
        <div className="inline-flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
          {([['30d', '30 dias'], ['90d', '90 dias'], ['12m', '12 meses'], ['custom', 'Personalizado']] as Array<[Period, string]>).map(([p, lbl]) => (
            <button key={p} type="button" onClick={() => onPeriod(p)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${period === p ? 'bg-primary-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{lbl}</button>
          ))}
        </div>
        {period === 'custom' && (
          <div className="inline-flex items-center gap-2">
            <input type="date" value={cFrom} onChange={(e) => setCFrom(e.target.value)} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1 text-sm text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" />
            <input type="date" value={cTo} onChange={(e) => setCTo(e.target.value)} className="rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 px-2 py-1 text-sm text-slate-900 dark:text-white [color-scheme:light] dark:[color-scheme:dark]" />
            <button type="button" onClick={() => load(network, 'custom', cFrom, cTo)} className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm font-semibold">Aplicar</button>
          </div>
        )}
      </div>

      {err && <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">{err}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi label="Publicações" value={loading ? '—' : nf(k?.posts ?? 0)} sub="no período" />
        <Kpi label="Interações totais" value={loading ? '—' : nf(k?.interactions ?? 0)} sub="reações + comentários + partilhas" />
        {data?.reach_available
          ? <Kpi label="Alcance" value={loading ? '—' : nf(data.reach ?? 0)} sub={reachWin?.clamped ? 'pessoas alcançadas (últimos 30 dias)' : 'pessoas alcançadas (período)'} />
          : <Kpi label="Alcance" value="—" sub={network === 'instagram' ? 'sem dados no período' : 'em breve'} />}
        <Kpi label="Média por post" value={loading ? '—' : nf(k?.avg ?? 0)} sub="interações/post" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_.8fr]">
        <Card title="🏆 Melhores publicações" pill="por interacção">
          {!loading && (data?.top ?? []).length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Sem publicações no período.</p>}
          {best && (
            <div className="rounded-xl border border-emerald-300/50 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/[.07] p-3 mb-3">
              <div className="flex justify-between items-center mb-1"><b className="text-slate-800 dark:text-slate-100">Publicação destacada</b></div>
              <div className="text-[13.5px] text-slate-700 dark:text-slate-200 line-clamp-2">{best.message || '(sem texto)'}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">👍 <b>{nf(best.reactions)}</b> · 💬 <b>{nf(best.comments)}</b> · ↗️ <b>{nf(best.shares)}</b></div>
            </div>
          )}
          {(data?.top ?? []).map((p, i) => (
            <a key={p.id} href={p.permalink ?? '#'} target="_blank" rel="noreferrer" className="flex gap-3 py-2.5 border-b border-slate-100 dark:border-white/10 last:border-0 hover:bg-slate-50 dark:hover:bg-white/[.03] rounded-lg px-1">
              <div className="w-6 text-center font-bold text-slate-400 self-center">{i + 1}</div>
              <div className="w-12 h-12 rounded-lg shrink-0 bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 flex items-center justify-center text-xl">{TYPE_EMOJI[p.media_type] ?? '📄'}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] text-slate-800 dark:text-slate-100 truncate">{p.message || '(sem texto)'}</div>
                <div className="text-xs text-slate-400 mt-0.5">{p.media_type} · {new Date(p.created_time).toLocaleDateString('pt-PT')}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">👍 <b>{nf(p.reactions)}</b> · 💬 <b>{nf(p.comments)}</b> · ↗️ <b>{nf(p.shares)}</b> · {nf(p.interactions)} total</div>
              </div>
            </a>
          ))}
        </Card>

        <div className="grid gap-4 content-start">
          <Card title="📈 Interacção ao longo do tempo">
            {(data?.timeline ?? []).length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Sem dados no período.</p> : (
              <div className="flex items-end gap-1 h-24">
                {data!.timeline.map((b) => (
                  <div key={b.label} title={`${b.label}: ${nf(b.value)}`} className="flex-1 rounded-t bg-gradient-to-b from-indigo-500 to-blue-500 min-h-[4px]" style={{ height: `${Math.round((b.value / maxTl) * 100)}%` }} />
                ))}
              </div>
            )}
          </Card>

          <Card title="🧩 O que funciona melhor" pill="por tipo">
            {(data?.by_type ?? []).length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Sem dados.</p> : data!.by_type.map((t) => (
              <div key={t.type} className="flex items-center gap-2.5 my-2">
                <div className="w-24 text-[13px] text-slate-500 dark:text-slate-400">{t.label}</div>
                <div className="flex-1 h-3.5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 overflow-hidden">
                  <span className="block h-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${Math.round((t.value / maxType) * 100)}%` }} />
                </div>
                <div className="w-14 text-right text-[13px] text-slate-700 dark:text-slate-200">{nf(t.value)}</div>
              </div>
            ))}
          </Card>
        </div>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500 border-t border-dashed border-slate-200 dark:border-white/10 pt-3">
        Fonte: API da Página e do Instagram (publicações + reações/comentários/partilhas, dados reais). O alcance único do período está a ser afinado para corresponder aos números da própria app da Meta. Liga ao analista IA e, mais tarde, ao MKT-BRAIN.
      </p>
    </div>
  );
}

function Kpi({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-3.5 relative">
      {warn && <span className="absolute top-2 right-2 text-[10px] text-amber-600 dark:text-amber-300 bg-amber-100 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/40 px-1.5 py-0.5 rounded-full">re-autorizar</span>}
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
