'use client';

// Blocos visuais do Painel Diário. Apresentação apenas — os dados vêm do
// snapshot de /api/painel. Copy PT-PT pré-AO 1990.
import React from 'react';
import { useRouter } from 'next/navigation';
import { Phone, PhoneOff, Home, TrendingUp, Layers, Target, CheckCircle2 } from 'lucide-react';
import {
  eur,
  type Carteira,
  type CoracaoDia,
  type PainelFunnel,
  type PainelKpis,
  type PipelineEtapa,
  type ReceitaLinha,
  type TopCanais,
} from '@/lib/painel/shared';

const card =
  'rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card shadow-sm';
const sectionTitle =
  'text-[11px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500';

/** A etapa com maior perda relativa face à anterior (onde mais trava). */
function gargalo(funnel: PainelFunnel): string | null {
  let worst: { label: string; drop: number } | null = null;
  for (let i = 1; i < funnel.stages.length; i++) {
    const prev = funnel.stages[i - 1].count;
    const cur = funnel.stages[i].count;
    if (prev <= 0) continue;
    const drop = (prev - cur) / prev;
    if (drop > 0 && (!worst || drop > worst.drop)) worst = { label: funnel.stages[i].label, drop };
  }
  return worst?.label ?? null;
}

export function FunnelCard({ funnel }: { funnel: PainelFunnel }) {
  const max = Math.max(1, ...funnel.stages.map((s) => s.count));
  const trava = gargalo(funnel);
  const temDados = funnel.stages.some((s) => s.count > 0) || funnel.wonCount > 0;
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-bold text-slate-900 dark:text-white">{funnel.displayName}</span>
        {trava ? (
          <span className="text-[10.5px] text-slate-400 dark:text-slate-500">
            Trava mais em <b className="text-amber-600 dark:text-amber-400">{trava}</b>
          </span>
        ) : (
          <span className="text-[10.5px] text-slate-400 dark:text-slate-500">{funnel.wonCount} fechados</span>
        )}
      </div>
      {!temDados ? (
        <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">Sem negócios abertos neste funil.</p>
      ) : (
        <div className="flex items-end gap-1.5 h-24">
          {funnel.stages.map((s, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end min-w-0" title={`${s.label}: ${s.count}`}>
              <span className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 mb-0.5">{s.count}</span>
              <div
                className="w-full rounded-t"
                style={{ height: `${Math.max(3, (s.count / max) * 72)}px`, background: s.color, opacity: s.count === 0 ? 0.25 : 1 }}
              />
              <span className="mt-1 text-[8.5px] leading-tight text-center text-slate-400 dark:text-slate-500 truncate w-full">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FunnelsRow({ funnels }: { funnels: PainelFunnel[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {funnels.map((f) => (
        <FunnelCard key={f.key} funnel={f} />
      ))}
    </div>
  );
}

function Kpi({
  label,
  value,
  hint,
  accent,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  accent: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) {
  return (
    <div className={`${card} p-4`} style={{ borderLeft: `3px solid ${accent}` }}>
      <div className="flex items-center gap-1.5">
        <Icon size={13} className="text-slate-400 dark:text-slate-500" />
        <span className={sectionTitle}>{label}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white mt-1.5">{value}</div>
      <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{hint}</div>
    </div>
  );
}

export function KpiRow({ kpis }: { kpis: PainelKpis }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Kpi
        label="Facturação"
        value={eur(kpis.faturacaoCents)}
        hint="comissões recebidas na janela"
        accent="#22c55e"
        icon={TrendingUp}
      />
      <Kpi
        label="Pipeline previsto"
        value={eur(kpis.pipelinePrevistoCents)}
        hint="comissão esperada dos negócios abertos"
        accent="#3b82f6"
        icon={Layers}
      />
      <Kpi
        label="Negócios abertos"
        value={String(kpis.negociosAbertos)}
        hint={`${kpis.abertosVendedores} vendedores · ${kpis.abertosCompradores} compradores`}
        accent="#a78bfa"
        icon={Target}
      />
      <Kpi
        label="Fechados"
        value={`${kpis.fechados} ✓`}
        hint={`${kpis.fechadosVendedores} vendas · ${kpis.fechadosCompradores} compradores`}
        accent="#f59e0b"
        icon={CheckCircle2}
      />
    </div>
  );
}

const RECEITA_COLORS = ['#f59e0b', '#2dd4bf', '#a78bfa', '#3b82f6'];

export function ReceitaCard({ linhas }: { linhas: ReceitaLinha[] }) {
  const max = Math.max(1, ...linhas.map((l) => l.cents));
  const temAlgo = linhas.some((l) => l.cents > 0);
  return (
    <div className={`${card} p-4`}>
      <div className={`${sectionTitle} mb-3`}>Receita por linha (na janela)</div>
      {!temAlgo ? (
        <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">Sem comissões fechadas na janela.</p>
      ) : (
        <div className="space-y-2.5">
          {linhas.map((l, i) => (
            <div key={l.key}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-slate-600 dark:text-slate-300">{l.label}</span>
                <b className="text-slate-900 dark:text-white">{eur(l.cents)}</b>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(l.cents / max) * 100}%`, background: RECEITA_COLORS[i % RECEITA_COLORS.length] }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10.5px] text-slate-400 dark:text-slate-500 mt-3">Créditos entram quando os começar a registar no CRM.</p>
    </div>
  );
}

export function PipelineEtapaCard({ etapas }: { etapas: PipelineEtapa[] }) {
  const max = Math.max(1, ...etapas.map((e) => e.count));
  return (
    <div className={`${card} p-4`}>
      <div className={`${sectionTitle} mb-3`}>Pipeline aberto por etapa · valor previsto</div>
      {etapas.length === 0 ? (
        <p className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">Sem negócios abertos.</p>
      ) : (
        <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
          {etapas.map((e, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 text-xs">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-slate-700 dark:text-slate-200">{e.label}</span>
                  <span className="shrink-0 text-[9px] px-1.5 py-px rounded-full bg-slate-100 dark:bg-white/10 text-slate-400 dark:text-slate-500">
                    {e.funnelName}
                  </span>
                </div>
                <div className="h-1 rounded-full bg-slate-100 dark:bg-white/10 mt-1 overflow-hidden">
                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${(e.count / max) * 100}%` }} />
                </div>
              </div>
              <b className="text-slate-900 dark:text-white tabular-nums w-6 text-right">{e.count}</b>
              <b className="text-slate-500 dark:text-slate-400 tabular-nums w-20 text-right">{eur(e.valueCents)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CoracaoCard({ coracao }: { coracao: CoracaoDia }) {
  const nums = [
    { v: coracao.tarefasPendentes, label: 'pendentes', sub: 'negócio à frente', cls: 'text-slate-900 dark:text-white' },
    { v: coracao.tarefasHoje, label: 'para hoje', sub: 'a fazer', cls: 'text-amber-500' },
    { v: coracao.tarefasAtrasadas, label: 'atrasadas', sub: 'em falta', cls: 'text-rose-500' },
    { v: coracao.tarefasFeitasHoje, label: 'feitas hoje', sub: 'concluídas', cls: 'text-emerald-500' },
  ];
  return (
    <div className={`${card} p-4`} style={{ borderColor: 'rgba(245,158,11,0.35)' }}>
      <div className="text-[11px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400 mb-3">
        ♥ O dia · Tarefas e Follow ups
      </div>
      <div className="grid grid-cols-4 gap-2 text-center mb-3">
        {nums.map((n) => (
          <div key={n.label}>
            <div className={`text-2xl font-bold ${n.cls}`}>{n.v}</div>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{n.label}</div>
          </div>
        ))}
      </div>
      <div className="border-t border-slate-100 dark:border-white/10 pt-3 flex flex-wrap gap-x-6 gap-y-1 justify-center text-xs">
        <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <PhoneOff size={13} className="text-rose-500" />
          Tentativas <b className="text-rose-500">{coracao.tentativasHoje}</b>
          <span className="text-slate-400 dark:text-slate-500">não atenderam</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <Phone size={13} className="text-emerald-500" />
          Realizadas <b className="text-emerald-500">{coracao.realizadasHoje}</b>
          <span className="text-slate-400 dark:text-slate-500">falei mesmo</span>
        </span>
      </div>
    </div>
  );
}

export function CarteiraCard({ carteira }: { carteira: Carteira }) {
  const router = useRouter();
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <span className={sectionTitle}>Carteira de imóveis</span>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-400">
          {carteira.activos} {carteira.activos === 1 ? 'activo' : 'activos'}
        </span>
      </div>
      {carteira.imoveis.length === 0 ? (
        <div className="py-6 text-center text-xs text-slate-400 dark:text-slate-500">
          <Home size={22} className="mx-auto mb-2 opacity-50" />
          Sem imóveis activos na carteira.
        </div>
      ) : (
        <div className="space-y-1.5">
          {carteira.imoveis.slice(0, 6).map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => router.push(`/imoveis/${i.id}`)}
              className="w-full text-left flex items-center justify-between gap-2 py-1.5 border-b border-slate-100 dark:border-white/5 last:border-0 hover:opacity-80"
            >
              <span className="text-xs text-slate-700 dark:text-slate-200 truncate">{i.titulo}</span>
              <span className="text-[10.5px] text-slate-400 dark:text-slate-500 shrink-0">
                {i.diasNoMercado}d · {i.visitas} {i.visitas === 1 ? 'visita' : 'visitas'}
                {i.propostas > 0 && (
                  <b className="text-amber-600 dark:text-amber-400"> · {i.propostas} prop.</b>
                )}
              </span>
            </button>
          ))}
          <p className="text-[10.5px] text-slate-400 dark:text-slate-500 pt-1">
            Esta semana: {carteira.visitasSemana} {carteira.visitasSemana === 1 ? 'visita' : 'visitas'}.
          </p>
        </div>
      )}
    </div>
  );
}

function CanalList({ titulo, canais, total, color }: { titulo: string; canais: { label: string; count: number }[]; total: number; color: string }) {
  const max = Math.max(1, ...canais.map((c) => c.count));
  return (
    <div className={`${card} p-4`}>
      <div className="flex items-center justify-between mb-3">
        <b className="text-sm text-slate-900 dark:text-white">{titulo}</b>
        <span className="text-[10.5px] text-slate-400 dark:text-slate-500">{total} contactos</span>
      </div>
      {canais.length === 0 ? (
        <p className="py-4 text-center text-xs text-slate-400 dark:text-slate-500">Sem entradas na janela.</p>
      ) : (
        <div className="space-y-2">
          {canais.slice(0, 6).map((c) => (
            <div key={c.label}>
              <div className="flex justify-between text-xs">
                <span className="text-slate-600 dark:text-slate-300">{c.label}</span>
                <b className="text-slate-900 dark:text-white">{c.count}</b>
              </div>
              <div className="h-1 rounded-full bg-slate-100 dark:bg-white/10 mt-1 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${(c.count / max) * 100}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopCanaisRow({ topCanais }: { topCanais: TopCanais }) {
  return (
    <div className="space-y-2">
      <div className={sectionTitle}>Top canais por negócio</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CanalList titulo="Vendedores" canais={topCanais.vendedores} total={topCanais.totalVendedores} color="#60a5fa" />
        <CanalList titulo="Compradores" canais={topCanais.compradores} total={topCanais.totalCompradores} color="#fbbf24" />
      </div>
    </div>
  );
}
