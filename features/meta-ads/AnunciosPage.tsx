'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TrendingUp, RefreshCw, Megaphone, Play, X, Brain, Pencil, Pause, PlayCircle, Loader2, ChevronDown, ChevronRight, Route as RouteIcon, BarChart3 } from 'lucide-react';
import { AdDrilldownDrawer } from './AdDrilldownDrawer';

export interface AdPerformanceRow {
  ad_id: string;
  ad_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  meta_leads: number;
  crm_leads: number;
  won_deals: number;
  won_value: number;
  currency: string | null;
  thumbnail_url: string | null;
  image_url: string | null;
  creative_type: string | null;
}

export interface AdAnalysis {
  ad_id: string;
  ad_name: string | null;
  verdict: 'parar' | 'aumentar' | 'testar' | 'manter';
  confidence: number | null;
  reason: string | null;
  suggestion: string | null;
  impact_eur: number | null;
  is_anomaly: boolean;
  days_with_data: number | null;
}

export interface AdStatus {
  status: string;
  effective_status: string;
  budget_cents: number | null;
  budget_kind: 'daily' | 'lifetime' | null;
  budget_level: 'adset' | 'campaign' | 'none';
}

// Estado legível a partir do effective_status da Meta.
function statusLabel(s: AdStatus | undefined): { text: string; cls: string; dot: string } {
  if (!s) return { text: '—', cls: 'text-slate-400', dot: 'bg-slate-300' };
  if (s.effective_status === 'ACTIVE') return { text: 'Activo', cls: 'text-emerald-700', dot: 'bg-emerald-500' };
  if (s.status === 'PAUSED') return { text: 'Em pausa', cls: 'text-slate-500', dot: 'bg-slate-400' };
  // Pausado a montante (adset/campanha) ou outro estado efectivo.
  const friendly: Record<string, string> = {
    ADSET_PAUSED: 'Adset em pausa',
    CAMPAIGN_PAUSED: 'Campanha em pausa',
    PAUSED: 'Em pausa',
    PENDING_REVIEW: 'Em revisão',
    DISAPPROVED: 'Reprovado',
    ARCHIVED: 'Arquivado',
    IN_PROCESS: 'A processar',
  };
  return { text: friendly[s.effective_status] ?? 'Em pausa', cls: 'text-amber-600', dot: 'bg-amber-400' };
}

const VERDICT_META: Record<string, { label: string; cls: string; panel: string }> = {
  parar: { label: 'Parar', cls: 'bg-rose-100 text-rose-700 border-rose-200', panel: 'border-rose-200 bg-rose-50' },
  aumentar: { label: 'Aumentar', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', panel: 'border-emerald-200 bg-emerald-50' },
  testar: { label: 'Testar', cls: 'bg-amber-100 text-amber-700 border-amber-200', panel: 'border-amber-200 bg-amber-50' },
  manter: { label: 'Manter', cls: 'bg-slate-100 text-slate-600 border-slate-200', panel: 'border-slate-200 bg-white' },
};

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
  { days: 365, label: '1 ano' },
  { days: 3650, label: 'Tudo' },
];

function money(value: number, currency: string | null): string {
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: currency || 'EUR',
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function num(value: number): string {
  return new Intl.NumberFormat('pt-PT').format(value || 0);
}

function pct(value: number | null): string {
  if (value === null) return '—';
  return `${value.toFixed(2)}%`;
}

// CPL/CPA/ROAS com guarda de divisão por zero.
function ratio(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  return numerator / denominator;
}

export const AnunciosPage: React.FC = () => {
  const [days, setDays] = useState(30);
  const [rows, setRows] = useState<AdPerformanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ url: string; name: string } | null>(null);
  const [analyses, setAnalyses] = useState<Map<string, AdAnalysis>>(new Map());
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [editing, setEditing] = useState<AdPerformanceRow | null>(null);
  const [drilling, setDrilling] = useState<AdPerformanceRow | null>(null);
  const [statuses, setStatuses] = useState<Map<string, AdStatus>>(new Map());

  const [campaignBoard, setCampaignBoard] = useState<Map<string, string>>(new Map());
  const [view, setView] = useState<'tabela' | 'arvore'>('tabela');

  const loadStatuses = useCallback(() => {
    fetch('/api/meta-ads/statuses', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const obj: Record<string, AdStatus> = j.statuses ?? {};
        setStatuses(new Map(Object.entries(obj)));
      })
      .catch(() => { /* coluna de estado é opcional */ });
  }, []);

  // Mapa campanha -> board de destino (para o chip "Destino" na tabela).
  const loadRouting = useCallback(() => {
    fetch('/api/meta-ads/routing', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const boards = new Map((j.boards ?? []).map((b: { id: string; name: string }) => [b.id, b.name]));
        const m = new Map<string, string>();
        for (const c of (j.campaigns ?? []) as { campaign_id: string; board_id: string | null }[]) {
          if (c.board_id && boards.has(c.board_id)) m.set(c.campaign_id, boards.get(c.board_id) as string);
        }
        setCampaignBoard(m);
      })
      .catch(() => { /* chip opcional */ });
  }, []);

  useEffect(() => { loadStatuses(); loadRouting(); }, [loadStatuses, loadRouting]);

  const loadAnalyses = useCallback(() => {
    fetch('/api/meta-ads/analyses', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        const items: AdAnalysis[] = Array.isArray(j.items) ? j.items : [];
        setAnalyses(new Map(items.map((a) => [a.ad_id, a])));
        setAnalyzedAt(j.analyzed_at ?? null);
      })
      .catch(() => { /* painel opcional */ });
  }, []);

  const runAnalysis = useCallback(() => {
    setAnalyzing(true);
    fetch('/api/meta-ads/analyze', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      .then((r) => r.json())
      .then(() => loadAnalyses())
      .catch(() => { /* erro silencioso; o cron diario cobre */ })
      .finally(() => setAnalyzing(false));
  }, [loadAnalyses]);

  useEffect(() => { loadAnalyses(); }, [loadAnalyses]);

  const load = useCallback((d: number) => {
    setLoading(true);
    setError(null);
    fetch(`/api/meta-ads/performance?days=${d}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j.error) { setError(j.error); return; }
        // numeric do Postgres pode chegar como string — coagir para aritmética segura.
        const items: AdPerformanceRow[] = (Array.isArray(j.items) ? j.items : []).map((r: AdPerformanceRow) => ({
          ...r,
          spend: Number(r.spend) || 0,
          impressions: Number(r.impressions) || 0,
          clicks: Number(r.clicks) || 0,
          meta_leads: Number(r.meta_leads) || 0,
          crm_leads: Number(r.crm_leads) || 0,
          won_deals: Number(r.won_deals) || 0,
          won_value: Number(r.won_value) || 0,
        }));
        setRows(items);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  const currency = rows[0]?.currency ?? 'EUR';

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.spend += r.spend || 0;
        acc.impressions += r.impressions || 0;
        acc.clicks += r.clicks || 0;
        acc.metaLeads += r.meta_leads || 0;
        acc.crmLeads += r.crm_leads || 0;
        acc.wonDeals += r.won_deals || 0;
        acc.wonValue += r.won_value || 0;
        return acc;
      },
      { spend: 0, impressions: 0, clicks: 0, metaLeads: 0, crmLeads: 0, wonDeals: 0, wonValue: 0 },
    );
  }, [rows]);

  const totalRoas = ratio(totals.wonValue, totals.spend);

  const ORDER: Record<string, number> = { parar: 0, aumentar: 1, testar: 2, manter: 3 };
  const recommendations = useMemo(() => {
    return [...analyses.values()]
      .filter((a) => a.verdict !== 'manter' || a.is_anomaly)
      .sort((a, b) => (b.is_anomaly ? 1 : 0) - (a.is_anomaly ? 1 : 0) || ORDER[a.verdict] - ORDER[b.verdict]);
  }, [analyses]);

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-violet-600" /> Anúncios
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Desempenho por anúncio do Meta Ads. Gasto e leads no período; negócios ganhos e dinheiro efectivo são a vida do anúncio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
            {PERIODS.map((p) => (
              <button
                key={p.days}
                onClick={() => setDays(p.days)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  days === p.days ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden" role="group" aria-label="Modo de visualização">
            {([['tabela', 'Tabela'], ['arvore', 'Árvore']] as const).map(([v, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  view === v ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60"
          >
            <Brain className="h-4 w-4" /> {analyzing ? 'A analisar...' : 'Analisar agora'}
          </button>
          <button
            onClick={() => { load(days); loadStatuses(); loadRouting(); }}
            className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 text-sm px-2 py-1.5"
            aria-label="Recarregar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {analyzedAt && (
        <p className="text-xs text-slate-400 -mt-3 mb-4">Última análise do analista IA: {analyzedAt}</p>
      )}

      {/* Cartões de totais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Kpi label="Gasto" value={money(totals.spend, currency)} />
        <Kpi label="Leads (Meta)" value={num(totals.metaLeads)} />
        <Kpi label="Leads (CRM)" value={num(totals.crmLeads)} />
        <Kpi label="Negócios ganhos" value={num(totals.wonDeals)} />
        <Kpi label="Dinheiro efectivo" value={money(totals.wonValue, currency)} />
        <Kpi label="ROAS" value={totalRoas === null ? '—' : `${totalRoas.toFixed(2)}x`} highlight />
      </div>

      {recommendations.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide mb-3 flex items-center gap-1.5">
            <Brain className="h-4 w-4 text-violet-600" /> Recomendações do analista
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {recommendations.map((a) => {
              const meta = VERDICT_META[a.verdict] ?? VERDICT_META.manter;
              return (
                <div key={a.ad_id} className={`rounded-lg border p-3 ${meta.panel}`}>
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-medium text-slate-900 text-sm truncate">{a.ad_name || a.ad_id}</span>
                    <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full border ${meta.cls}`}>{meta.label}</span>
                  </div>
                  {a.is_anomaly && <div className="text-xs font-medium text-rose-600 mb-1">⚠ Anomalia</div>}
                  {a.reason && <p className="text-xs text-slate-600">{a.reason}</p>}
                  {a.suggestion && <p className="text-xs text-slate-800 mt-1"><span className="font-medium">Sugestão:</span> {a.suggestion}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <LeadRoutingPanel />

      {error ? (
        <div className="rounded-md bg-rose-50 text-rose-700 p-4 text-sm">Erro ao carregar: {error}</div>
      ) : loading ? (
        <div className="rounded-md border border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          A carregar desempenho...
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-300 p-12 text-center">
          <TrendingUp className="h-8 w-8 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Sem dados de anúncios neste período. As métricas são sincronizadas diariamente (gerível em Automações).</p>
        </div>
      ) : view === 'arvore' ? (
        <AdTree
          rows={rows}
          analyses={analyses}
          statuses={statuses}
          onDrill={setDrilling}
          onEdit={setEditing}
          onLightbox={setLightbox}
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-semibold">Anúncio</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
                <th className="px-3 py-2 font-semibold text-right" title="Orçamento diário do conjunto de anúncios (adset)">Orç./dia</th>
                <th className="px-3 py-2 font-semibold text-right">Gasto</th>
                <th className="px-3 py-2 font-semibold text-right">Impressões</th>
                <th className="px-3 py-2 font-semibold text-right">Cliques</th>
                <th className="px-3 py-2 font-semibold text-right" title="Taxa de cliques (cliques / impressões)">CTR</th>
                <th className="px-3 py-2 font-semibold text-right" title="Custo por clique">CPC</th>
                <th className="px-3 py-2 font-semibold text-right">Leads</th>
                <th className="px-3 py-2 font-semibold text-right" title="Conversão clique → lead">Cliq→Lead</th>
                <th className="px-3 py-2 font-semibold text-right">CPL</th>
                <th className="px-3 py-2 font-semibold text-right">Ganhos</th>
                <th className="px-3 py-2 font-semibold text-right">CPA</th>
                <th className="px-3 py-2 font-semibold text-right">Efectivo</th>
                <th className="px-3 py-2 font-semibold text-right">ROAS</th>
                <th className="px-3 py-2 font-semibold text-right">Editar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const st = statuses.get(r.ad_id);
                const stLabel = statusLabel(st);
                const leadsForCpl = r.crm_leads || r.meta_leads;
                const cpl = ratio(r.spend, leadsForCpl);
                const cpa = ratio(r.spend, r.won_deals);
                const roas = ratio(r.won_value, r.spend);
                const ctrRatio = ratio(r.clicks, r.impressions);
                const ctr = ctrRatio === null ? null : ctrRatio * 100;
                const cpc = ratio(r.spend, r.clicks);
                const clickToLeadRatio = ratio(leadsForCpl, r.clicks);
                const clickToLead = clickToLeadRatio === null ? null : clickToLeadRatio * 100;
                return (
                  <tr key={r.ad_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2.5">
                        {r.thumbnail_url ? (
                          <button
                            type="button"
                            onClick={() => setLightbox({ url: r.image_url ?? r.thumbnail_url!, name: r.ad_name || r.ad_id })}
                            className="relative shrink-0 rounded-md overflow-hidden border border-slate-200 hover:ring-2 hover:ring-violet-300 focus-visible:ring-2 focus-visible:ring-violet-400 outline-none"
                            title="Ver criativo"
                          >
                            <img src={r.thumbnail_url} alt={r.ad_name || 'Criativo do anúncio'} className="w-11 h-11 object-cover" loading="lazy" />
                            {r.creative_type === 'video' && (
                              <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                                <Play className="w-4 h-4 text-white" fill="currentColor" />
                              </span>
                            )}
                          </button>
                        ) : (
                          <div className="w-11 h-11 shrink-0 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300">
                            <Megaphone className="w-4 h-4" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-slate-900 truncate max-w-[220px] flex items-center gap-1.5">
                            <span className="truncate">{r.ad_name || r.ad_id}</span>
                            {(() => {
                              const a = analyses.get(r.ad_id);
                              if (!a || (a.verdict === 'manter' && !a.is_anomaly)) return null;
                              const m = VERDICT_META[a.verdict] ?? VERDICT_META.manter;
                              return <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${m.cls}`} title={a.reason || ''}>{m.label}</span>;
                            })()}
                          </div>
                          {r.campaign_name && <div className="text-xs text-slate-400 truncate max-w-[220px]">{r.campaign_name}</div>}
                          {r.campaign_id && (
                            campaignBoard.has(r.campaign_id) ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-1 mt-0.5" title="Board de destino das leads desta campanha">
                                → {campaignBoard.get(r.campaign_id)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[10px] text-amber-600 mt-0.5" title="Sem board de destino definido para esta campanha">
                                → destino por definir
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap" title={st?.effective_status || ''}>
                        <span className={`w-2 h-2 rounded-full ${stLabel.dot}`} />
                        <span className={`text-xs font-medium ${stLabel.cls}`}>{stLabel.text}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-600 whitespace-nowrap">
                      {st?.budget_cents ? (
                        <span className="inline-flex items-center gap-1 justify-end">
                          {money(st.budget_cents / 100, r.currency)}
                          {st.budget_level === 'campaign' && (
                            <span className="text-[10px] font-semibold text-violet-500 bg-violet-50 border border-violet-200 rounded px-1" title="Orçamento ao nível da campanha (CBO)">CBO</span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(r.spend, r.currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{num(r.impressions)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{num(r.clicks)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{pct(ctr)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{cpc === null ? '—' : money(cpc, r.currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {num(r.crm_leads || r.meta_leads)}
                      {r.crm_leads === 0 && r.meta_leads > 0 && (
                        <span className="text-slate-400 text-xs" title="Contagem da Meta (sem leads no CRM atribuídas a este anúncio)"> *</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{pct(clickToLead)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{cpl === null ? '—' : money(cpl, r.currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.won_deals || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{cpa === null ? '—' : money(cpa, r.currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.won_value ? money(r.won_value, r.currency) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {roas === null ? '—' : <span className={roas >= 1 ? 'text-emerald-600' : 'text-slate-700'}>{roas.toFixed(2)}x</span>}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => setDrilling(r)}
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 focus-visible:ring-2 focus-visible:ring-primary-400 outline-none mr-1"
                        title="Ver dados deste anúncio (criativo, copy, leads e negócios)"
                        aria-label={`Ver dados de ${r.ad_name || r.ad_id}`}
                      >
                        <BarChart3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(r)}
                        className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 focus-visible:ring-2 focus-visible:ring-violet-400 outline-none"
                        title="Editar anúncio (pausar/reactivar, orçamento)"
                        aria-label={`Editar ${r.ad_name || r.ad_id}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-400 mt-3">
        Leads marcadas com <span className="font-medium">*</span> usam a contagem da Meta (ainda sem leads atribuídas a esse anúncio no CRM). CPL usa as leads do CRM quando existem.
      </p>

      {lightbox && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-modal="true"
          aria-label={`Criativo: ${lightbox.name}`}
        >
          <div className="relative max-w-2xl max-h-[85dvh]" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setLightbox(null)}
              aria-label="Fechar"
              className="absolute -top-3 -right-3 bg-white rounded-full p-1.5 shadow-lg text-slate-600 hover:text-slate-900"
            >
              <X className="w-5 h-5" />
            </button>
            <img src={lightbox.url} alt={lightbox.name} className="max-w-full max-h-[80dvh] rounded-lg object-contain bg-white" />
            <p className="text-center text-white text-sm mt-2">{lightbox.name}</p>
          </div>
        </div>
      )}

      {drilling && (
        <AdDrilldownDrawer
          adId={drilling.ad_id}
          adNameFallback={drilling.ad_name || drilling.ad_id}
          onClose={() => setDrilling(null)}
        />
      )}

      {editing && (
        <AdEditModal
          ad={editing}
          onClose={() => setEditing(null)}
          onDone={() => {
            setEditing(null);
            load(days);
            loadAnalyses();
            loadStatuses();
            loadRouting();
          }}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// MA-DRILLDOWN Fase 2 — vista em árvore Campanha › Conjunto › Anúncio.
// Agrupa as mesmas linhas da tabela e soma os totais (gasto/leads/CPL/ROAS) em
// cada nível. Campanhas abertas por omissão; conjuntos fechados (drill ao clicar).
// ---------------------------------------------------------------------------
interface Rollup { spend: number; leads: number; won_deals: number; won_value: number; }
function emptyRoll(): Rollup { return { spend: 0, leads: 0, won_deals: 0, won_value: 0 }; }
function addRoll(acc: Rollup, r: AdPerformanceRow) {
  acc.spend += r.spend || 0;
  acc.leads += (r.crm_leads || r.meta_leads) || 0;
  acc.won_deals += r.won_deals || 0;
  acc.won_value += r.won_value || 0;
}
interface TreeAdset { id: string; name: string | null; roll: Rollup; ads: AdPerformanceRow[]; }
interface TreeCampaign { id: string; name: string | null; roll: Rollup; adsets: TreeAdset[]; }

function MetricCells({ roll, currency }: { roll: Rollup; currency: string }) {
  const cpl = ratio(roll.spend, roll.leads);
  const roas = ratio(roll.won_value, roll.spend);
  return (
    <>
      <span className="w-[84px] shrink-0 text-right tabular-nums text-sm">{money(roll.spend, currency)}</span>
      <span className="w-[58px] shrink-0 text-right tabular-nums text-sm text-slate-500 hidden sm:block">{num(roll.leads)}</span>
      <span className="w-[76px] shrink-0 text-right tabular-nums text-sm">{cpl === null ? '—' : money(cpl, currency)}</span>
      <span className="w-[58px] shrink-0 text-right tabular-nums text-sm hidden sm:block">
        {roas === null ? <span className="text-slate-300">—</span> : <span className={roas >= 1 ? 'text-emerald-600 font-medium' : 'text-slate-700'}>{roas.toFixed(1)}x</span>}
      </span>
    </>
  );
}

const AdTree: React.FC<{
  rows: AdPerformanceRow[];
  analyses: Map<string, AdAnalysis>;
  statuses: Map<string, AdStatus>;
  onDrill: (r: AdPerformanceRow) => void;
  onEdit: (r: AdPerformanceRow) => void;
  onLightbox: (l: { url: string; name: string }) => void;
}> = ({ rows, analyses, statuses, onDrill, onEdit, onLightbox }) => {
  const [closedCamps, setClosedCamps] = useState<Set<string>>(new Set());
  const [openAdsets, setOpenAdsets] = useState<Set<string>>(new Set());
  const currency = rows[0]?.currency ?? 'EUR';

  const tree = useMemo<TreeCampaign[]>(() => {
    const campMap = new Map<string, TreeCampaign>();
    const adsetMap = new Map<string, TreeAdset>();
    for (const r of rows) {
      const cid = r.campaign_id || '—';
      let c = campMap.get(cid);
      if (!c) { c = { id: cid, name: r.campaign_name, roll: emptyRoll(), adsets: [] }; campMap.set(cid, c); }
      addRoll(c.roll, r);
      const aKey = `${cid}|${r.adset_id || '—'}`;
      let a = adsetMap.get(aKey);
      if (!a) { a = { id: r.adset_id || '—', name: r.adset_name, roll: emptyRoll(), ads: [] }; adsetMap.set(aKey, a); c.adsets.push(a); }
      addRoll(a.roll, r);
      a.ads.push(r);
    }
    const arr = [...campMap.values()].sort((x, y) => y.roll.spend - x.roll.spend);
    arr.forEach((c) => c.adsets.sort((x, y) => y.roll.spend - x.roll.spend));
    return arr;
  }, [rows]);

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key); else next.add(key);
    setter(next);
  };

  function verdictBadge(adId: string) {
    const a = analyses.get(adId);
    if (!a || (a.verdict === 'manter' && !a.is_anomaly)) return null;
    const m = VERDICT_META[a.verdict] ?? VERDICT_META.manter;
    return <span className={`shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${m.cls}`} title={a.reason || ''}>{m.label}</span>;
  }

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden">
      {/* cabeçalho */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400 font-semibold">
        <span className="flex-1">Campanha › Conjunto › Anúncio</span>
        <span className="w-[84px] text-right">Gasto</span>
        <span className="w-[58px] text-right hidden sm:block">Leads</span>
        <span className="w-[76px] text-right">CPL</span>
        <span className="w-[58px] text-right hidden sm:block">ROAS</span>
        <span className="w-[58px] shrink-0" aria-hidden="true" />
      </div>

      {tree.map((c) => {
        const campOpen = !closedCamps.has(c.id);
        return (
          <div key={c.id} className="border-t border-slate-100">
            {/* Campanha */}
            <button
              type="button"
              onClick={() => toggle(closedCamps, setClosedCamps, c.id)}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left bg-violet-50/30 hover:bg-violet-50"
            >
              {campOpen ? <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />}
              <span className="flex-1 min-w-0 font-bold text-sm text-slate-900 truncate">{c.name || c.id}</span>
              <MetricCells roll={c.roll} currency={currency} />
              <span className="w-[58px] shrink-0" aria-hidden="true" />
            </button>

            {campOpen && c.adsets.map((a) => {
              const aKey = `${c.id}|${a.id}`;
              const adsetOpen = openAdsets.has(aKey);
              return (
                <div key={aKey}>
                  {/* Conjunto */}
                  <button
                    type="button"
                    onClick={() => toggle(openAdsets, setOpenAdsets, aKey)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left border-t border-slate-50 hover:bg-slate-50"
                  >
                    <span className="pl-5 shrink-0">{adsetOpen ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}</span>
                    <span className="flex-1 min-w-0 font-semibold text-[13px] text-slate-600 truncate">{a.name || a.id} <span className="text-slate-400 font-normal">({a.ads.length})</span></span>
                    <MetricCells roll={a.roll} currency={currency} />
                    <span className="w-[58px] shrink-0" aria-hidden="true" />
                  </button>

                  {adsetOpen && a.ads.map((r) => {
                    const st = statuses.get(r.ad_id);
                    const stLabel = statusLabel(st);
                    const single: Rollup = emptyRoll();
                    addRoll(single, r);
                    return (
                      <div key={r.ad_id} className="flex items-center gap-2 px-3 py-2 border-t border-slate-50 hover:bg-slate-50/70">
                        <div className="flex items-center gap-2 flex-1 min-w-0 pl-12">
                          {r.thumbnail_url ? (
                            <button
                              type="button"
                              onClick={() => onLightbox({ url: r.image_url ?? r.thumbnail_url!, name: r.ad_name || r.ad_id })}
                              className="relative shrink-0 rounded-md overflow-hidden border border-slate-200 hover:ring-2 hover:ring-violet-300 outline-none"
                              title="Ver criativo"
                            >
                              <img src={r.thumbnail_url} alt={r.ad_name || 'Criativo'} className="w-9 h-9 object-cover" loading="lazy" />
                              {r.creative_type === 'video' && (
                                <span className="absolute inset-0 flex items-center justify-center bg-black/30"><Play className="w-3.5 h-3.5 text-white" fill="currentColor" /></span>
                              )}
                            </button>
                          ) : (
                            <div className="w-9 h-9 shrink-0 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-300"><Megaphone className="w-3.5 h-3.5" /></div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[13px] font-medium text-slate-900 truncate max-w-[180px] sm:max-w-[260px]">{r.ad_name || r.ad_id}</span>
                              {verdictBadge(r.ad_id)}
                            </div>
                            <span className="inline-flex items-center gap-1 text-[11px]">
                              <span className={`w-1.5 h-1.5 rounded-full ${stLabel.dot}`} />
                              <span className={stLabel.cls}>{stLabel.text}</span>
                            </span>
                          </div>
                        </div>
                        <MetricCells roll={single} currency={currency} />
                        <div className="w-[58px] shrink-0 flex items-center justify-end gap-0.5">
                          <button type="button" onClick={() => onDrill(r)} title="Ver dados deste anúncio" aria-label={`Ver dados de ${r.ad_name || r.ad_id}`}
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 outline-none">
                            <BarChart3 className="w-4 h-4" />
                          </button>
                          <button type="button" onClick={() => onEdit(r)} title="Editar anúncio" aria-label={`Editar ${r.ad_name || r.ad_id}`}
                            className="inline-flex items-center justify-center rounded-md p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 outline-none">
                            <Pencil className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Modal de edição do anúncio (MA-EDIT, tier fácil).
// Lê o estado vivo da Meta antes de qualquer alteração e exige confirmação
// explícita. Pausar/reactivar é por anúncio; orçamento é do adset (afecta todos
// os anúncios do adset) — a UI di-lo claramente. CBO não é editável aqui.
// ---------------------------------------------------------------------------
interface AdLiveState {
  ad_id: string;
  ad_name: string | null;
  status: string;
  effective_status: string;
  adset_id: string | null;
  adset_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  budget_level: 'adset' | 'campaign' | 'none';
  budget_id: string | null;
  budget_cents: number | null;
  budget_kind: 'daily' | 'lifetime' | null;
}

const AdEditModal: React.FC<{
  ad: AdPerformanceRow;
  onClose: () => void;
  onDone: () => void;
}> = ({ ad, onClose, onDone }) => {
  const [state, setState] = useState<AdLiveState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'pause' | 'resume' | 'budget' | null>(null);
  const [budgetInput, setBudgetInput] = useState('');
  const currency = ad.currency || 'EUR';

  const loadState = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch(`/api/meta-ads/ad/${ad.ad_id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j.error) { setError(j.error); return; }
        const s: AdLiveState = j.state;
        setState(s);
        setBudgetInput(s.budget_cents ? (s.budget_cents / 100).toFixed(2) : '');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ad.ad_id]);

  useEffect(() => { loadState(); }, [loadState]);

  const act = useCallback(
    (body: Record<string, unknown>, optimisticMsg: string) => {
      setBusy(true);
      setError(null);
      fetch('/api/meta-ads/edit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
        .then((r) => r.json())
        .then((j) => {
          if (j.error) { setError(j.error); setConfirm(null); return; }
          // sucesso: fecha e recarrega a página
          onDone();
        })
        .catch((e) => setError(e.message))
        .finally(() => setBusy(false));
      void optimisticMsg;
    },
    [onDone],
  );

  const isActive = state?.status === 'ACTIVE';
  const budgetKind: 'daily' | 'lifetime' = state?.budget_kind ?? 'daily';
  const currentCents = state?.budget_cents ?? null;
  const isCbo = state?.budget_level === 'campaign';
  const newCents = Math.round((parseFloat(budgetInput.replace(',', '.')) || 0) * 100);

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Editar anúncio ${ad.ad_name || ad.ad_id}`}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[90dvh] overflow-y-auto rounded-xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 truncate">{ad.ad_name || ad.ad_id}</h3>
            {ad.campaign_name && <p className="text-xs text-slate-400 truncate">{ad.campaign_name}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="shrink-0 text-slate-400 hover:text-slate-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> A ler o estado actual na Meta...
            </div>
          ) : !state ? (
            <div className="rounded-md bg-rose-50 text-rose-700 p-3 text-sm">
              {error || 'Não foi possível ler o anúncio.'}
              <button onClick={loadState} className="ml-2 underline">Tentar de novo</button>
            </div>
          ) : (
            <>
              {error && <div className="rounded-md bg-rose-50 text-rose-700 p-3 text-sm">{error}</div>}

              {/* Estado actual */}
              <div className="rounded-lg border border-slate-200 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-500">Estado actual</span>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${
                      isActive
                        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}
                  >
                    {isActive ? 'Activo' : state.status === 'PAUSED' ? 'Em pausa' : state.status}
                  </span>
                </div>
                {state.effective_status && state.effective_status !== state.status && (
                  <p className="text-xs text-slate-400 mt-1">Estado efectivo na Meta: {state.effective_status}</p>
                )}
              </div>

              {/* Pausar / reactivar */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Estado do anúncio</h4>
                {confirm === 'pause' || confirm === 'resume' ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-sm text-slate-800">
                      Vai {confirm === 'pause' ? 'pausar' : 'reactivar'} «{ad.ad_name || ad.ad_id}» na Meta. Confirma?
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button
                        disabled={busy}
                        onClick={() => act({ action: confirm === 'pause' ? 'pause_ad' : 'resume_ad', ad_id: ad.ad_id }, '')}
                        className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
                      >
                        {busy && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar
                      </button>
                      <button disabled={busy} onClick={() => setConfirm(null)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : isActive ? (
                  <button
                    onClick={() => setConfirm('pause')}
                    className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 w-full justify-center"
                  >
                    <Pause className="w-4 h-4" /> Pausar anúncio
                  </button>
                ) : (
                  <button
                    onClick={() => setConfirm('resume')}
                    className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50 w-full justify-center"
                  >
                    <PlayCircle className="w-4 h-4" /> Reactivar anúncio
                  </button>
                )}
              </div>

              {/* Orçamento (adset ou campanha/CBO) */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">Orçamento</h4>
                {state.budget_level === 'none' || !state.budget_id ? (
                  <p className="text-sm text-slate-500 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    Este anúncio não tem orçamento editável.
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400">
                      {isCbo ? (
                        <>Orçamento {budgetKind === 'daily' ? 'diário' : 'total'} da campanha (CBO)
                        {state.campaign_name ? ` «${state.campaign_name}»` : ''}. Afecta todos os anúncios da campanha.</>
                      ) : (
                        <>Orçamento {budgetKind === 'daily' ? 'diário' : 'total'} do adset
                        {state.adset_name ? ` «${state.adset_name}»` : ''}. Afecta todos os anúncios deste adset.</>
                      )}
                    </p>
                    {confirm === 'budget' ? (
                      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                        <p className="text-sm text-slate-800">
                          Alterar o orçamento {budgetKind === 'daily' ? 'diário' : 'total'} {isCbo ? 'da campanha' : 'do adset'} de{' '}
                          <b>{currentCents ? money(currentCents / 100, currency) : '—'}</b> para{' '}
                          <b>{money(newCents / 100, currency)}</b>?
                        </p>
                        <div className="flex gap-2 mt-3">
                          <button
                            disabled={busy}
                            onClick={() => act({ action: 'set_budget', ad_id: ad.ad_id, amount_cents: newCents, kind: budgetKind }, '')}
                            className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-60"
                          >
                            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Confirmar
                          </button>
                          <button disabled={busy} onClick={() => setConfirm(null)} className="text-sm px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="relative flex-1">
                          <input
                            type="number"
                            min="1"
                            step="0.01"
                            inputMode="decimal"
                            value={budgetInput}
                            onChange={(e) => setBudgetInput(e.target.value)}
                            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
                            aria-label="Novo orçamento"
                          />
                        </div>
                        <button
                          disabled={!newCents || newCents === currentCents}
                          onClick={() => setConfirm('budget')}
                          className="text-sm font-medium px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
                        >
                          Guardar
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

function Kpi({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${highlight ? 'border-violet-200 bg-violet-50' : 'border-slate-200 bg-white'}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`text-lg font-semibold mt-0.5 ${highlight ? 'text-violet-700' : 'text-slate-900'}`}>{value}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Encaminhamento de leads por campanha (R2). Cada campanha aponta para um
// board+etapa; quando entra uma lead, cai logo no pipeline certo. Sem destino,
// a lead entra só como contacto e o Telegram avisa para atribuir.
// ---------------------------------------------------------------------------
interface RoutingCampaign {
  campaign_id: string;
  campaign_name: string | null;
  board_id: string | null;
  stage_id: string | null;
}
interface RoutingBoard {
  id: string;
  name: string;
  stages: { id: string; name: string }[];
}

const LeadRoutingPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState<RoutingCampaign[]>([]);
  const [boards, setBoards] = useState<RoutingBoard[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/meta-ads/routing', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (j.campaigns) setCampaigns(j.campaigns);
        if (j.boards) setBoards(j.boards);
        setLoaded(true);
      })
      .catch(() => { /* painel opcional */ })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (open && !loaded) load(); }, [open, loaded, load]);

  const save = useCallback((camp: RoutingCampaign, boardId: string | null, stageId: string | null) => {
    setSavingId(camp.campaign_id);
    // optimismo local
    setCampaigns((prev) => prev.map((c) => c.campaign_id === camp.campaign_id ? { ...c, board_id: boardId, stage_id: stageId } : c));
    fetch('/api/meta-ads/routing', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ campaign_id: camp.campaign_id, campaign_name: camp.campaign_name, board_id: boardId, stage_id: stageId }),
    })
      .catch(() => { /* recarrega em caso de erro */ load(); })
      .finally(() => setSavingId(null));
  }, [load]);

  const pendentes = campaigns.filter((c) => !c.board_id).length;

  return (
    <div className="mb-6 rounded-lg border border-slate-200">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <RouteIcon className="h-4 w-4 text-violet-600" />
          Encaminhamento de leads (por campanha)
          {loaded && pendentes > 0 && (
            <span className="text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
              {pendentes} por definir
            </span>
          )}
        </span>
        {open ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100 p-4">
          <p className="text-xs text-slate-500 mb-3">
            Cada campanha define o intuito (comprador, proprietário, arrendamento). A lead nova cai logo no board escolhido.
            Sem destino, fica como contacto e o Telegram avisa para atribuíres.
          </p>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 py-4 justify-center">
              <Loader2 className="w-4 h-4 animate-spin" /> A carregar campanhas...
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-slate-400">Sem campanhas com dados ainda.</p>
          ) : (
            <div className="space-y-2">
              {campaigns.map((c) => {
                const board = boards.find((b) => b.id === c.board_id);
                return (
                  <div key={c.campaign_id} className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-lg border border-slate-100 p-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-slate-800 truncate">{c.campaign_name || c.campaign_id}</div>
                      {!c.board_id && <div className="text-xs text-amber-600">Por definir</div>}
                    </div>
                    <select
                      value={c.board_id ?? ''}
                      onChange={(e) => {
                        const bid = e.target.value || null;
                        const firstStage = bid ? boards.find((b) => b.id === bid)?.stages[0]?.id ?? null : null;
                        save(c, bid, firstStage);
                      }}
                      className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
                      aria-label={`Board de destino da campanha ${c.campaign_name || c.campaign_id}`}
                    >
                      <option value="">— Sem destino —</option>
                      {boards.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    {board && board.stages.length > 0 && (
                      <select
                        value={c.stage_id ?? ''}
                        onChange={(e) => save(c, c.board_id, e.target.value || null)}
                        className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm bg-white focus:border-violet-400 focus:ring-2 focus:ring-violet-100 outline-none"
                        aria-label="Etapa de entrada"
                      >
                        {board.stages.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    )}
                    {savingId === c.campaign_id && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
