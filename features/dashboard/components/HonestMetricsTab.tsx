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
  X,
  ChevronDown,
  ChevronUp,
  Users,
  MapPin,
  MessageCircle,
  Mail,
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
  daily_chq_target: number;
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

type ChqBreakdownDay = {
  date: string;
  day_of_week: number;
  is_today: boolean;
  count: number;
  activities: number;
  new_contacts: number;
};

const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

type ChqTodayItem = {
  id: string;
  type: 'call' | 'meeting' | 'visit' | 'whatsapp' | 'email';
  created_at: string;
  deal_id: string | null;
  contact_id: string | null;
  description: string | null;
  via: string | null;
  deal_title: string | null;
  contact_name: string | null;
};

const TYPE_ICON: Record<ChqTodayItem['type'], React.ComponentType<{ size?: number; className?: string }>> = {
  call: Phone,
  meeting: Users,
  visit: MapPin,
  whatsapp: MessageCircle,
  email: Mail,
};

const TYPE_LABEL: Record<ChqTodayItem['type'], string> = {
  call: 'Chamada',
  meeting: 'Reunião',
  visit: 'Visita',
  whatsapp: 'WhatsApp',
  email: 'Email',
};

export const HonestMetricsTab: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [data, setData] = useState<HonestMetrics | null>(null);
  const [breakdown, setBreakdown] = useState<ChqBreakdownDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showTodayList, setShowTodayList] = useState(false);
  const [todayItems, setTodayItems] = useState<ChqTodayItem[]>([]);
  const [todayLoading, setTodayLoading] = useState(false);

  const loadTodayItems = () => {
    setTodayLoading(true);
    fetch('/api/dashboard/chq-today', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setTodayItems(Array.isArray(j.items) ? j.items : []))
      .catch(() => setTodayItems([]))
      .finally(() => setTodayLoading(false));
  };

  const deleteToday = (id: string) => {
    setTodayItems((items) => items.filter((i) => i.id !== id));
    fetch(`/api/dashboard/chq-today?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      .then(() => {
        // refresh contagem global
        if (data) {
          fetch(`/api/dashboard/honest-metrics?year=${year}`, { cache: 'no-store' })
            .then((r) => r.json())
            .then((j) => { if (j.metrics) setData(j.metrics); })
            .catch(() => {});
        }
      })
      .catch(() => {});
  };

  const toggleTodayList = () => {
    setShowTodayList((v) => {
      const next = !v;
      if (next) loadTodayItems();
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    fetch('/api/dashboard/chq-breakdown?days=7', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (!cancelled && Array.isArray(j.breakdown)) setBreakdown(j.breakdown);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [year]);

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
        {(() => {
          const target = data.daily_chq_target || 0;
          const today = data.chq.today;
          const pct = target > 0 ? (today / target) * 100 : null;
          const variant = pct === null
            ? 'default' as const
            : pct >= 100 ? 'green' as const
            : pct >= 60 ? 'amber' as const
            : 'red' as const;
          const subtitle = target > 0
            ? `Meta diária ${target} · ${pct?.toFixed(0)}% · Semana ${data.chq.week} · Mês ${data.chq.month}`
            : `Semana ${data.chq.week} · Mês ${data.chq.month}`;
          return (
            <MetricCard
              icon={Phone}
              title="CHQ hoje"
              value={today}
              subtitle={subtitle}
              variant={variant}
              tooltip="Conversas Humanas Qualificadas: activities tipo call/meeting/visit/whatsapp/email + contactos novos com telefone ou email. Semáforo vs meta diária definida em /settings/metas."
            />
          );
        })()}
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

      {/* Sprint 16 c1: CHQ por dia (últimos 7 dias) */}
      {breakdown.length > 0 && (() => {
        const maxCount = Math.max(1, ...breakdown.map((b) => b.count));
        const weekTotal = breakdown.reduce((acc, b) => acc + b.count, 0);
        const weekAvg = weekTotal / breakdown.length;
        return (
          <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Phone className="h-4 w-4 text-primary-500" />
                CHQ esta semana
              </h3>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Total <strong className="text-slate-900 dark:text-white">{weekTotal}</strong> · Média/dia{' '}
                <strong className="text-slate-900 dark:text-white">{weekAvg.toFixed(1)}</strong>
              </div>
            </div>
            <div className="flex items-end justify-between gap-2 h-32">
              {breakdown.map((b) => {
                const heightPct = (b.count / maxCount) * 100;
                const barColor = b.is_today
                  ? 'bg-primary-500'
                  : b.count === 0
                    ? 'bg-slate-200 dark:bg-white/10'
                    : 'bg-primary-300 dark:bg-primary-500/40';
                const dayLabel = WEEKDAY_LABELS[(b.day_of_week - 1) % 7];
                return (
                  <div key={b.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 tabular-nums">
                      {b.count}
                    </div>
                    <div className="w-full flex items-end h-20">
                      <div
                        className={`w-full rounded-t-md ${barColor} transition-all`}
                        style={{ height: `${Math.max(4, heightPct)}%` }}
                        title={`${b.date}: ${b.count} CHQ (${b.activities} activities + ${b.new_contacts} contactos novos)`}
                      />
                    </div>
                    <div className={`text-[10px] ${b.is_today ? 'text-primary-600 dark:text-primary-400 font-bold' : 'text-slate-400'}`}>
                      {dayLabel}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary-500"></span> Hoje</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary-300 dark:bg-primary-500/40"></span> Outros dias</span>
              <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-slate-200 dark:bg-white/10"></span> Sem CHQ</span>
              <button
                type="button"
                onClick={toggleTodayList}
                className="ml-auto inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline"
              >
                {showTodayList ? 'Esconder lista de hoje' : 'Ver lista de hoje'}
                {showTodayList ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>

            {showTodayList && (
              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-white/5">
                {todayLoading ? (
                  <p className="text-xs text-slate-400">A carregar...</p>
                ) : todayItems.length === 0 ? (
                  <p className="text-xs text-slate-400">Ainda nenhuma CHQ registada hoje. Liga, escreve, regista.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {todayItems.map((it) => {
                      const Ico = TYPE_ICON[it.type];
                      const label = it.deal_title || it.contact_name || 'Sem alvo';
                      const time = new Date(it.created_at).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
                      return (
                        <li key={it.id} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 group">
                          <span className="text-slate-400 dark:text-slate-500 w-12">{time}</span>
                          <Ico size={12} className="text-primary-500 flex-shrink-0" />
                          <span className="font-medium text-slate-800 dark:text-slate-200 w-20 truncate">{TYPE_LABEL[it.type]}</span>
                          <span className="truncate flex-1" title={label}>{label}</span>
                          {it.via && <span className="text-[10px] text-slate-400 dark:text-slate-500 hidden md:inline">via {it.via}</span>}
                          <button
                            type="button"
                            onClick={() => deleteToday(it.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500 transition-opacity"
                            title="Apagar (engano)"
                          >
                            <X size={12} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })()}

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
