'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { TrendingUp, RefreshCw, Megaphone } from 'lucide-react';

export interface AdPerformanceRow {
  ad_id: string;
  ad_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  spend: number;
  impressions: number;
  clicks: number;
  meta_leads: number;
  crm_leads: number;
  won_deals: number;
  won_value: number;
  currency: string | null;
}

const PERIODS = [
  { days: 7, label: '7 dias' },
  { days: 30, label: '30 dias' },
  { days: 90, label: '90 dias' },
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

  return (
    <div className="p-6 max-w-7xl">
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
          <button
            onClick={() => load(days)}
            className="text-slate-500 hover:text-slate-900 inline-flex items-center gap-1 text-sm px-2 py-1.5"
            aria-label="Recarregar"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Cartões de totais */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Kpi label="Gasto" value={money(totals.spend, currency)} />
        <Kpi label="Leads (Meta)" value={num(totals.metaLeads)} />
        <Kpi label="Leads (CRM)" value={num(totals.crmLeads)} />
        <Kpi label="Negócios ganhos" value={num(totals.wonDeals)} />
        <Kpi label="Dinheiro efectivo" value={money(totals.wonValue, currency)} />
        <Kpi label="ROAS" value={totalRoas === null ? '—' : `${totalRoas.toFixed(2)}x`} highlight />
      </div>

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
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-semibold">Anúncio</th>
                <th className="px-3 py-2 font-semibold text-right">Gasto</th>
                <th className="px-3 py-2 font-semibold text-right">Impressões</th>
                <th className="px-3 py-2 font-semibold text-right">Cliques</th>
                <th className="px-3 py-2 font-semibold text-right">Leads</th>
                <th className="px-3 py-2 font-semibold text-right">CPL</th>
                <th className="px-3 py-2 font-semibold text-right">Ganhos</th>
                <th className="px-3 py-2 font-semibold text-right">CPA</th>
                <th className="px-3 py-2 font-semibold text-right">Efectivo</th>
                <th className="px-3 py-2 font-semibold text-right">ROAS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const leadsForCpl = r.crm_leads || r.meta_leads;
                const cpl = ratio(r.spend, leadsForCpl);
                const cpa = ratio(r.spend, r.won_deals);
                const roas = ratio(r.won_value, r.spend);
                return (
                  <tr key={r.ad_id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <div className="font-medium text-slate-900">{r.ad_name || r.ad_id}</div>
                      {r.campaign_name && <div className="text-xs text-slate-400">{r.campaign_name}</div>}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(r.spend, r.currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{num(r.impressions)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-500">{num(r.clicks)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {num(r.crm_leads || r.meta_leads)}
                      {r.crm_leads === 0 && r.meta_leads > 0 && (
                        <span className="text-slate-400 text-xs" title="Contagem da Meta (sem leads no CRM atribuídas a este anúncio)"> *</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{cpl === null ? '—' : money(cpl, r.currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.won_deals || '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{cpa === null ? '—' : money(cpa, r.currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.won_value ? money(r.won_value, r.currency) : '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-medium">
                      {roas === null ? '—' : <span className={roas >= 1 ? 'text-emerald-600' : 'text-slate-700'}>{roas.toFixed(2)}x</span>}
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
