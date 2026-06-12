/**
 * DASH-2 — hook do lead scoring: sinais da rota /api/deals/lead-scores → mapa
 * deal_id → { score, temperature, reasons } calculado pela lib pura (testada).
 * Cache de 2 minutos: o score deriva do histórico, não precisa de tempo real.
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { computeLeadScores, type LeadScore, type LeadScoreSignals } from '@/lib/deals/leadScore';

interface LeadScoresResponse {
  signals: LeadScoreSignals[];
  today: string;
}

async function fetchLeadScores(): Promise<Record<string, LeadScore>> {
  const res = await fetch('/api/deals/lead-scores');
  if (!res.ok) {
    const err = await res.json().catch(() => null);
    throw new Error(err?.error || 'Falhou a leitura dos sinais de scoring');
  }
  const data: LeadScoresResponse = await res.json();
  return computeLeadScores(data.signals ?? [], data.today);
}

export function useLeadScoresQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: queryKeys.leadScores.all,
    queryFn: fetchLeadScores,
    enabled: options?.enabled !== false,
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}
