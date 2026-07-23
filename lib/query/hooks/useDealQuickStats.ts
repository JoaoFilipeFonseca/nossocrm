/**
 * useDealQuickStats — contadores rápidos por negócio (manuais · automáticos · tarefas).
 * Uma chamada à RPC deal_quick_stats por lista visível (aceita array de deal ids).
 */
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { supabase } from '@/lib/supabase';

export interface DealQuickStats {
  manual: number;
  auto: number;
  tasks: number;
}

export type DealQuickStatsMap = Record<string, DealQuickStats>;

interface RpcRow {
  deal_id: string;
  manual_touches: number;
  auto_touches: number;
  open_tasks: number;
}

export function useDealQuickStats(dealIds: string[]) {
  const ids = [...new Set(dealIds)].filter(Boolean);

  return useQuery({
    queryKey: queryKeys.dealQuickStats.byDeals(ids),
    enabled: ids.length > 0,
    staleTime: 60_000,
    queryFn: async (): Promise<DealQuickStatsMap> => {
      const { data, error } = await supabase.rpc('deal_quick_stats', { p_deal_ids: ids });
      if (error) throw error;
      const map: DealQuickStatsMap = {};
      for (const r of (data as RpcRow[] | null) ?? []) {
        map[r.deal_id] = {
          manual: r.manual_touches ?? 0,
          auto: r.auto_touches ?? 0,
          tasks: r.open_tasks ?? 0,
        };
      }
      return map;
    },
  });
}
