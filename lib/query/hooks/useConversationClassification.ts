'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';

export type FunnelKey = 'compradores' | 'proprietarios' | 'arrendamento';

export interface ClassificationState {
  hasContact: boolean;
  inboundCount: number;
  hasOpenDeal: boolean;
  currentBoardId: string | null;
  currentBoardName: string | null;
}

const classificationKey = (conversationId: string) =>
  ['messaging', 'classification', conversationId] as const;

/** Estado actual da classificação de uma conversa (funil do negócio + continuidade). */
export function useConversationClassification(conversationId: string | undefined) {
  return useQuery({
    queryKey: classificationKey(conversationId ?? 'none'),
    enabled: !!conversationId,
    staleTime: 30_000,
    queryFn: async (): Promise<ClassificationState> => {
      const res = await fetch(`/api/messaging/conversations/${conversationId}/classify`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao ler classificação');
      }
      return res.json();
    },
  });
}

/** Classifica/promove a conversa num funil (cria ou move o negócio). */
export function useClassifyConversation(conversationId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      funnel: FunnelKey
    ): Promise<{ dealId: string; created: boolean; boardId: string; boardName: string }> => {
      const res = await fetch(`/api/messaging/conversations/${conversationId}/classify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funnel }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Erro ao classificar conversa');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: classificationKey(conversationId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.deals.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.messagingConversations.all });
    },
  });
}
