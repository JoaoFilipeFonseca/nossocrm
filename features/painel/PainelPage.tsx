'use client';

// Painel Diário — o cockpit que o João vê ao abrir o CRM.
// Lê /api/painel na hora, refaz a cada 60s, ao focar a janela e em tempo real
// (negócios + tarefas). Alterna para o painel detalhado legado sem perder nada.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRealtimeSync } from '@/lib/realtime/useRealtimeSync';
import { PAINEL_WINDOWS, windowLabel, type PainelSnapshot, type PainelWindow } from '@/lib/painel/shared';
import {
  CarteiraCard,
  CoracaoCard,
  FunnelsRow,
  KpiRow,
  PipelineEtapaCard,
  ReceitaCard,
  TopCanaisRow,
} from './components/PainelBlocks';

const LegacyDashboard = dynamic(() => import('@/features/dashboard/DashboardPage'), {
  ssr: false,
  loading: () => <div className="py-16 text-center text-sm text-slate-400">A carregar painel detalhado…</div>,
});

const WINDOW_STORE = 'painel:window';

function useStoredWindow(): [PainelWindow, (w: PainelWindow) => void] {
  const [win, setWin] = useState<PainelWindow>('90d');
  useEffect(() => {
    const saved = typeof window !== 'undefined' ? (window.localStorage.getItem(WINDOW_STORE) as PainelWindow | null) : null;
    if (saved && PAINEL_WINDOWS.includes(saved)) setWin(saved);
  }, []);
  const set = useCallback((w: PainelWindow) => {
    setWin(w);
    try {
      window.localStorage.setItem(WINDOW_STORE, w);
    } catch {
      /* best-effort */
    }
  }, []);
  return [win, set];
}

const SkeletonCard = ({ h = 'h-28' }: { h?: string }) => (
  <div className={`rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 animate-pulse ${h}`} />
);

const PainelPage: React.FC = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [win, setWin] = useStoredWindow();
  const [view, setView] = useState<'diario' | 'detalhado'>('diario');
  const lastNudge = useRef(0);

  const queryKey = ['painel', win] as const;
  const { data, isLoading, isError, refetch, isFetching } = useQuery<PainelSnapshot>({
    queryKey,
    queryFn: async ({ signal }) => {
      const res = await fetch(`/api/painel?window=${win}`, { cache: 'no-store', signal });
      if (!res.ok) throw new Error('Falha a carregar o painel');
      return res.json();
    },
    enabled: !!user && view === 'diario',
    staleTime: 0,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  // Tempo real: nudge (com throttle 5s) quando muda um negócio ou tarefa.
  const onRealtime = useCallback(() => {
    const now = Date.now();
    if (now - lastNudge.current < 5_000) return;
    lastNudge.current = now;
    queryClient.invalidateQueries({ queryKey: ['painel'] });
  }, [queryClient]);
  useRealtimeSync(['deals', 'activities'], { enabled: view === 'diario', onchange: onRealtime });

  return (
    <div className="max-w-6xl mx-auto space-y-4 pb-8">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display text-slate-900 dark:text-white">Painel Diário</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            O mais importante do negócio, sempre actual.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {view === 'diario' && (
            <>
              <div className="inline-flex gap-0.5 p-0.5 rounded-lg bg-slate-100 dark:bg-white/5">
                {PAINEL_WINDOWS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setWin(w)}
                    className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors ${
                      win === w
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                    title={windowLabel(w)}
                  >
                    {w}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => refetch()}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 hover:text-slate-700 dark:hover:text-slate-200"
                title="Actualizar agora"
              >
                <RefreshCw size={15} className={isFetching ? 'animate-spin' : ''} />
              </button>
            </>
          )}
          <div className="inline-flex gap-0.5 p-0.5 rounded-lg bg-slate-100 dark:bg-white/5">
            <button
              type="button"
              onClick={() => setView('diario')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                view === 'diario' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Diário
            </button>
            <button
              type="button"
              onClick={() => setView('detalhado')}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors ${
                view === 'detalhado' ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Detalhado
            </button>
          </div>
        </div>
      </div>

      {view === 'detalhado' ? (
        <LegacyDashboard />
      ) : isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SkeletonCard h="h-36" />
            <SkeletonCard h="h-36" />
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <SkeletonCard h="h-48" />
            <SkeletonCard h="h-48" />
          </div>
        </div>
      ) : isError || !data ? (
        <div className="py-16 text-center">
          <p className="text-sm text-rose-600 dark:text-rose-400">Não foi possível carregar o painel.</p>
          <button onClick={() => refetch()} className="mt-3 text-sm text-primary-600 hover:underline">
            Tentar de novo
          </button>
        </div>
      ) : (
        <>
          <FunnelsRow funnels={data.funnels} />
          <KpiRow kpis={data.kpis} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ReceitaCard linhas={data.receitaLinhas} />
            <PipelineEtapaCard etapas={data.pipelinePorEtapa} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CoracaoCard coracao={data.coracao} />
            <CarteiraCard carteira={data.carteira} />
          </div>
          <TopCanaisRow topCanais={data.topCanais} />
        </>
      )}
    </div>
  );
};

export default PainelPage;
