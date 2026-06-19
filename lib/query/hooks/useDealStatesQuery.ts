/**
 * PONTO 1 — hook da "verdade única" do estado: sinais de /api/deals/state-signals
 * → mapa deal_id → DealStateSignals. Cache de 2 minutos (deriva do histórico de
 * toques, não precisa de tempo real). Mesmo padrão de [[useLeadScoresQuery]].
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import type { DealStateSignals } from '@/lib/deals/dealState';

interface StateSignalsResponse {
  signals: DealStateSignals[];
}

async function fetchDealStates(): Promise<Record<string, DealStateSignals>> {
  const res = await fetch('/api/deals/state-signals');
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Falhou a leitura dos sinais de estado');
  }
  const data: StateSignalsResponse = await res.json();
  const map: Record<string, DealStateSignals> = {};
  for (const s of data.signals ?? []) map[s.deal_id] = s;
  return map;
}

export function useDealStatesQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.dealStates.all,
    queryFn: fetchDealStates,
    enabled: options?.enabled !== false,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
