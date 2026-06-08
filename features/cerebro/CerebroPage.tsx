'use client';

/**
 * Cérebro de Marketing (MKT-BRAIN) — capstone do MKT-MEASURE. Junta anúncios +
 * funil + CAPI/ganhos + orgânico e mostra os padrões que a IA encontra + acções.
 * Maqueta aprovada: docs/mockups/mkt-brain.html. Dados ao vivo via /api/cerebro.
 */
import React, { useCallback, useEffect, useState } from 'react';

type Flow = { spend: number; interactions: number; leads_total: number; open: number; won: number; won_value: number; roas: number | null };
type Source = { ad_id: string; ad_name: string; spend: number; leads: number; won: number; won_value: number };
type Brain = { headline: string; insights: Array<{ title: string; detail: string; confidence: string }>; actions: Array<{ kind: string; text: string }> };
type Data = { days: number; flow: Flow; sources: Source[]; organic_top: Array<{ message: string; interactions: number; media_type: string }>; brain: Brain | null };

const eur = (x: number) => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(x || 0);
const nf = (x: number) => new Intl.NumberFormat('pt-PT').format(x || 0);

const ACT: Record<string, { label: string; cls: string }> = {
  reforcar: { label: 'reforçar', cls: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/40' },
  parar: { label: 'parar', cls: 'bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/40' },
  repetir: { label: 'repetir', cls: 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-blue-500/40' },
  corrigir: { label: 'corrigir gargalo', cls: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/40' },
};

export function CerebroPage() {
  const [days, setDays] = useState(90);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (d: number) => {
    setLoading(true); setErr(null);
    try {
      const res = await fetch(`/api/cerebro?days=${d}`, { credentials: 'same-origin' });
      const json = await res.json();
      if (json.error) setErr(json.error);
      setData(json.flow ? (json as Data) : null);
    } catch { setErr('Não foi possível carregar o cérebro.'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(90); }, [load]);
  const onDays = (d: number) => { setDays(d); load(d); };

  const f = data?.flow;
  const wins = (data?.sources ?? []).filter((s) => s.won > 0).length;

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      <header>
        <h1 className="text-xl font-bold font-display text-slate-900 dark:text-white">🧠 Cérebro de Marketing</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Anúncios + orgânico + funil + negócios ganhos — e os padrões de quem realmente fecha.</p>
      </header>

      <div className="inline-flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
        {[[30, '30 dias'], [90, '90 dias'], [365, '12 meses']].map(([d, lbl]) => (
          <button key={d} type="button" onClick={() => onDays(d as number)} className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${days === d ? 'bg-primary-600 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{lbl}</button>
        ))}
      </div>

      {err && <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">{err}</div>}

      {/* Percurso completo */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[.03] p-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">🔁 Percurso completo <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">do euro investido ao negócio</span></h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Step label="Investido" value={loading ? '—' : eur(f?.spend ?? 0)} sub="Meta Ads" tag="ads" />
          <Step label="Interações (orgânico)" value={loading ? '—' : nf(f?.interactions ?? 0)} sub="posts da Página" tag="org" />
          <Step label="Leads → no funil" value={loading ? '—' : `${nf(f?.leads_total ?? 0)} → ${nf(f?.open ?? 0)}`} sub="entraram → abertos" tag="crm" />
          <Step label="Ganhos" value={loading ? '—' : `${f?.won ?? 0} · ${eur(f?.won_value ?? 0)}`} sub="comissão líquida" tag="capi" />
          <Step label="ROAS" value={loading ? '—' : f?.roas == null ? 's/ dados' : `${f.roas}×`} sub="valor / investido" tag="capi" />
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">O salto a vigiar é <b>Leads → Ganhos</b>: traz-se muita gente, mas poucos fecham.</p>
      </div>

      {/* O que traz quem fecha */}
      <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[.03] p-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">🎯 O que traz quem FECHA <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">cruza anúncio × negócios ganhos</span></h2>
        {!loading && (data?.sources ?? []).length === 0 ? <p className="text-sm text-slate-500 dark:text-slate-400">Sem dados de anúncios no período.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13.5px] border-collapse">
              <thead><tr className="text-slate-500 dark:text-slate-400 text-xs">
                <th className="text-left py-2 pr-2">Anúncio</th><th className="text-right px-2">Leads</th><th className="text-right px-2">Ganhos</th><th className="text-right px-2">Valor</th><th className="text-right pl-2">€/lead</th>
              </tr></thead>
              <tbody>
                {(data?.sources ?? []).map((s) => (
                  <tr key={s.ad_id} className="border-t border-slate-100 dark:border-white/10">
                    <td className="py-2 pr-2 text-slate-800 dark:text-slate-100 max-w-[280px] truncate">{s.ad_name}</td>
                    <td className="text-right px-2">{nf(s.leads)}</td>
                    <td className={`text-right px-2 ${s.won > 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}`}>{s.won}</td>
                    <td className={`text-right px-2 ${s.won_value > 0 ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ''}`}>{eur(s.won_value)}</td>
                    <td className="text-right pl-2 text-slate-500 dark:text-slate-400">{s.leads > 0 ? eur(s.spend / s.leads) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">{loading ? '' : `Os negócios ganhos vieram de ${wins} ${wins === 1 ? 'fonte' : 'fontes'}. Anúncios com muitas leads e 0 ganhos são candidatos a rever.`} <span className="opacity-70">(Atribuição orgânico→negócio: follow-up.)</span></p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Padrões IA */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[.03] p-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">🔎 Padrões que a IA encontrou</h2>
          {loading && <p className="text-sm text-slate-500 dark:text-slate-400">A analisar…</p>}
          {!loading && !data?.brain && <p className="text-sm text-slate-500 dark:text-slate-400">Sem análise disponível (verifica as chaves de IA nas definições).</p>}
          {data?.brain?.headline && <p className="text-sm text-slate-700 dark:text-slate-200 mb-2 font-medium">{data.brain.headline}</p>}
          {(data?.brain?.insights ?? []).map((ins, i) => (
            <div key={i} className="border-l-[3px] border-violet-500 bg-slate-50 dark:bg-white/[.03] rounded-lg px-3 py-2 my-2">
              <div className="text-[13.5px] font-semibold text-slate-800 dark:text-slate-100">{ins.title} <span className="text-[11px] font-normal text-violet-500 dark:text-violet-300">· confiança {ins.confidence}</span></div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{ins.detail}</div>
            </div>
          ))}
        </div>

        {/* Acções */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/[.03] p-4">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">✅ Próximas acções</h2>
          {!loading && (data?.brain?.actions ?? []).length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">Sem acções sugeridas.</p>}
          {(data?.brain?.actions ?? []).map((a, i) => {
            const meta = ACT[a.kind] ?? { label: a.kind, cls: 'bg-slate-500/15 text-slate-500 border-slate-500/40' };
            return (
              <div key={i} className="flex items-start gap-2 my-2 text-[13.5px] text-slate-700 dark:text-slate-200">
                <span className={`text-[11px] px-2 py-0.5 rounded-full border shrink-0 mt-0.5 ${meta.cls}`}>{meta.label}</span>
                <div>{a.text}</div>
              </div>
            );
          })}
          <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">As acções nascem das 4 fontes; a IA actualiza-as a cada análise.</p>
        </div>
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500 border-t border-dashed border-slate-200 dark:border-white/10 pt-3">
        Fontes: Anúncios (ad_insights), Funil/negócios (deals), Desfecho (CAPI / comissão líquida), Orgânico (Página). A IA recebe um resumo das 4 (Gemini → Claude).
      </p>
    </div>
  );
}

function Step({ label, value, sub, tag }: { label: string; value: string; sub: string; tag: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 p-3 relative">
      <span className="absolute top-2 right-2 text-[10px] text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-white/10 px-1.5 rounded-full">{tag}</span>
      <div className="text-xs text-slate-500 dark:text-slate-400">{label}</div>
      <div className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">{value}</div>
      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>
    </div>
  );
}
