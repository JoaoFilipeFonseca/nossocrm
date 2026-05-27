'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Target,
  Phone,
  Briefcase,
  TrendingUp,
  Gauge,
  GitBranch,
  Clock,
  Info,
  Calendar,
  ArrowRight,
} from 'lucide-react';

type Semaphore = 'red' | 'amber' | 'green' | 'unknown';

type HonestMetrics = {
  generated_at: string;
  organization_id: string;
  owner_id: string | null;
  year: number;
  windows: {
    today_start: string;
    week_start: string;
    month_start: string;
    year_start: string;
  };
  chq: {
    today: number;
    week: number;
    month: number;
    types_counted: string[];
  };
  meetings_visits_week: number;
  open_proposals: {
    count: number;
    total_value_eur: number;
  };
  weighted_pipeline_eur: number;
  goal: {
    year: number;
    annual_target_eur: number;
    ytd_target_eur: number;
    ytd_realized_eur: number;
    gap_eur: number;
    pct: number | null;
    semaphore: Semaphore;
    has_goal: boolean;
  };
  stage_conversion: Array<{
    board_id: string;
    stage_id: string;
    stage_label: string;
    order: number;
    deals_in_or_past: number;
    deals_total_board: number;
    pct: number;
  }>;
  avg_time_per_stage_days: Array<{
    stage_label: string;
    avg_days: number;
    samples: number;
  }>;
};

function fmtEur(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  return `${Math.round(n).toLocaleString('pt-PT')} €`;
}

function semaphoreClasses(sem: Semaphore): { bg: string; text: string; border: string; dot: string } {
  switch (sem) {
    case 'green':
      return {
        bg: 'bg-emerald-50 dark:bg-emerald-500/10',
        text: 'text-emerald-700 dark:text-emerald-300',
        border: 'border-emerald-200 dark:border-emerald-500/30',
        dot: 'bg-emerald-500',
      };
    case 'amber':
      return {
        bg: 'bg-amber-50 dark:bg-amber-500/10',
        text: 'text-amber-700 dark:text-amber-300',
        border: 'border-amber-200 dark:border-amber-500/30',
        dot: 'bg-amber-500',
      };
    case 'red':
      return {
        bg: 'bg-rose-50 dark:bg-rose-500/10',
        text: 'text-rose-700 dark:text-rose-300',
        border: 'border-rose-200 dark:border-rose-500/30',
        dot: 'bg-rose-500',
      };
    default:
      return {
        bg: 'bg-slate-50 dark:bg-white/5',
        text: 'text-slate-600 dark:text-slate-300',
        border: 'border-slate-200 dark:border-white/10',
        dot: 'bg-slate-400',
      };
  }
}

type MetricCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  tooltip?: string;
  variant?: 'default' | 'red' | 'amber' | 'green';
};

const MetricCard: React.FC<MetricCardProps> = ({ icon: Icon, title, value, subtitle, tooltip, variant = 'default' }) => {
  const borderClass =
    variant === 'red'
      ? 'border-rose-200 dark:border-rose-500/30'
      : variant === 'amber'
        ? 'border-amber-200 dark:border-amber-500/30'
        : variant === 'green'
          ? 'border-emerald-200 dark:border-emerald-500/30'
          : 'border-slate-200 dark:border-white/10';

  return (
    <div className={`bg-white dark:bg-white/5 rounded-2xl border ${borderClass} p-5 flex flex-col gap-2`}>
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm">
        <Icon className="h-4 w-4" />
        <span>{title}</span>
        {tooltip && (
          <span className="ml-auto" title={tooltip}>
            <Info className="h-3.5 w-3.5 text-slate-400" />
          </span>
        )}
      </div>
      <div className="text-3xl font-bold text-slate-900 dark:text-white font-display">{value}</div>
      {subtitle && <div className="text-xs text-slate-500 dark:text-slate-400">{subtitle}</div>}
    </div>
  );
};

export const HonestMetricsTab: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [data, setData] = useState<HonestMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/dashboard/honest-metrics?year=${year}`, { cache: 'no-store' })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return;
        if (!ok) {
          setError(j.error || 'Erro a carregar métricas.');
          setData(null);
        } else {
          setData(j.metrics);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || 'Erro de rede.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year]);

  const semColors = useMemo(() => (data ? semaphoreClasses(data.goal.semaphore) : semaphoreClasses('unknown')), [data]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 rounded-2xl p-4">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const yearsAvailable = Array.from(new Set([currentYear - 1, currentYear, currentYear + 1])).sort((a, b) => b - a);

  // Agrupar conv por board
  const convByBoard = data.stage_conversion.reduce<Record<string, typeof data.stage_conversion>>((acc, row) => {
    if (!acc[row.board_id]) acc[row.board_id] = [];
    acc[row.board_id].push(row);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header da subaba: selector de ano + link metas */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Calendar className="h-4 w-4" />
          <span>Ano:</span>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="rounded-md border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 px-2 py-1 text-sm text-slate-900 dark:text-white"
          >
            {yearsAvailable.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          {!data.goal.has_goal && (
            <Link
              href="/settings/metas"
              className="ml-3 inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline"
            >
              Definir meta <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
        <div className="text-xs text-slate-400 dark:text-slate-500">
          Gerado {new Date(data.generated_at).toLocaleString('pt-PT')}
        </div>
      </div>

      {/* Top row: 4 cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={Phone}
          title="CHQ hoje"
          value={data.chq.today}
          subtitle={`Semana ${data.chq.week} · Mês ${data.chq.month}`}
          tooltip="Conversas Humanas Qualificadas: activities tipo call/meeting/visit/whatsapp/email + contactos novos com telefone ou email."
        />
        <MetricCard
          icon={Briefcase}
          title="Reuniões + visitas (semana)"
          value={data.meetings_visits_week}
          tooltip="deal_activities tipo meeting ou visit criadas esta semana (Seg→hoje, Lisbon)."
        />
        <MetricCard
          icon={GitBranch}
          title="Propostas em aberto"
          value={data.open_proposals.count}
          subtitle={fmtEur(data.open_proposals.total_value_eur)}
          tooltip="Deals abertos cuja fase actual tem nome ou label a começar por 'propost'."
        />
        <MetricCard
          icon={TrendingUp}
          title="Receita ponderada pendente"
          value={fmtEur(data.weighted_pipeline_eur)}
          tooltip="Σ (valor × probabilidade/100) dos deals abertos."
        />
      </div>

      {/* Gap meta com semáforo */}
      <div className={`rounded-2xl border p-5 ${semColors.bg} ${semColors.border}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className={`h-3 w-3 rounded-full ${semColors.dot}`} />
            <div>
              <div className={`text-sm font-medium ${semColors.text}`}>Gap meta ({data.year})</div>
              <div className="text-2xl font-bold text-slate-900 dark:text-white font-display mt-1">
                {fmtEur(data.goal.ytd_realized_eur)} <span className="text-slate-400 text-base font-normal">de</span>{' '}
                {fmtEur(data.goal.ytd_target_eur)} <span className="text-slate-400 text-base font-normal">YTD</span>
              </div>
              <div className={`text-sm mt-1 ${semColors.text}`}>
                {data.goal.has_goal
                  ? data.goal.pct !== null
                    ? `${data.goal.pct.toFixed(1)}% da meta YTD · ${data.goal.gap_eur >= 0 ? '+' : ''}${fmtEur(data.goal.gap_eur)} face ao alvo`
                    : 'Sem alvo YTD calculável.'
                  : 'Meta não definida — define em /settings/metas para activar o semáforo.'}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 text-right">
            <div className="text-xs text-slate-500 dark:text-slate-400">Meta anual</div>
            <div className="text-lg font-semibold text-slate-700 dark:text-slate-200">{fmtEur(data.goal.annual_target_eur)}</div>
            {!data.goal.has_goal && (
              <Link href="/settings/metas" className="text-xs text-primary-600 dark:text-primary-400 hover:underline">
                Definir agora →
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Conversão por fase (por board) */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
          <Gauge className="h-4 w-4 text-primary-500" />
          Taxa de conversão por fase
        </h3>
        {Object.keys(convByBoard).length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Sem boards configurados.</p>
        ) : (
          <div className="space-y-5">
            {Object.entries(convByBoard).map(([boardId, rows]) => (
              <div key={boardId}>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                  Board <code className="text-[10px]">{boardId.slice(0, 8)}</code> · {rows[0]?.deals_total_board ?? 0} deals
                </div>
                <div className="space-y-1.5">
                  {rows.map((r) => (
                    <div key={r.stage_id} className="flex items-center gap-3 text-sm">
                      <div className="w-44 text-slate-700 dark:text-slate-200 truncate" title={r.stage_label}>
                        {r.stage_label}
                      </div>
                      <div className="flex-1 h-2 bg-slate-100 dark:bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary-500"
                          style={{ width: `${Math.min(100, r.pct)}%` }}
                        />
                      </div>
                      <div className="w-28 text-right text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                        {r.deals_in_or_past}/{r.deals_total_board} · {r.pct.toFixed(1)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tempo médio por fase */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
          <Clock className="h-4 w-4 text-primary-500" />
          Tempo médio por fase
        </h3>
        {data.avg_time_per_stage_days.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Sem dados suficientes ainda (precisa de 2+ mudanças de fase registadas por deal).
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {data.avg_time_per_stage_days.map((s) => (
              <div
                key={s.stage_label}
                className="flex items-center justify-between text-sm border border-slate-100 dark:border-white/5 rounded-lg p-3"
              >
                <span className="text-slate-700 dark:text-slate-200 truncate" title={s.stage_label}>
                  {s.stage_label}
                </span>
                <span className="text-slate-900 dark:text-white font-semibold tabular-nums">
                  {s.avg_days.toFixed(1)}d
                  <span className="text-xs text-slate-400 dark:text-slate-500 ml-1">({s.samples})</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1 mt-2">
        <Info className="h-3 w-3" />
        Métricas honestas calculadas em Europe/Lisbon. CHQ depende de registar activities tipo call/meeting/visit/whatsapp/email.
      </p>
    </div>
  );
};
