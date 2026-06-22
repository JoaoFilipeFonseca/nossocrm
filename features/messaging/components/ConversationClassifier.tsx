'use client';

import React from 'react';
import { Home, KeyRound, Search, Loader2, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/context/ToastContext';
import {
  useConversationClassification,
  useClassifyConversation,
  useConversationFunnelSuggestion,
  type FunnelKey,
} from '@/lib/query/hooks/useConversationClassification';

const FUNNELS: { key: FunnelKey; label: string; icon: React.FC<{ className?: string }> }[] = [
  { key: 'compradores', label: 'Comprador', icon: Search },
  { key: 'proprietarios', label: 'Proprietário', icon: Home },
  { key: 'arrendamento', label: 'Arrendamento', icon: KeyRound },
];

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * Secção "Classificar" no painel do contacto (WA-4a): botões directos para
 * classificar/promover a conversa num funil. O consultor decide; nada acontece
 * sozinho. A continuidade (2.ª mensagem recebida) só mostra o aviso.
 */
export function ConversationClassifier({ conversationId }: { conversationId: string }) {
  const { addToast } = useToast();
  const { data: state, isLoading } = useConversationClassification(conversationId);
  const classify = useClassifyConversation(conversationId);
  // WA-4b: sugestão de funil por IA (só corre quando há contacto + mensagens).
  const { data: suggestion } = useConversationFunnelSuggestion(
    conversationId,
    !!state?.hasContact && (state?.inboundCount ?? 0) >= 1
  );

  if (isLoading || !state) {
    return null;
  }

  if (!state.hasContact) {
    return (
      <div className="border-b border-slate-200 dark:border-white/10 py-3 px-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
          Classificar
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Vincule um contacto a esta conversa para a poder classificar num funil.
        </p>
      </div>
    );
  }

  const currentFunnel = state.currentBoardName ? normalize(state.currentBoardName) : null;
  const showContinuityHint = state.inboundCount >= 2 && !state.hasOpenDeal;
  const suggestedFunnel: FunnelKey | null =
    suggestion && suggestion.funnel !== 'indefinido' ? (suggestion.funnel as FunnelKey) : null;
  const suggestedLabel = FUNNELS.find((f) => f.key === suggestedFunnel)?.label;

  const handleClassify = (funnel: FunnelKey) => {
    classify.mutate(funnel, {
      onSuccess: (res) => {
        addToast(
          res.created
            ? `Negócio criado em ${res.boardName} → Oportunidade.`
            : `Negócio movido para ${res.boardName}.`,
          'success'
        );
      },
      onError: (err) => {
        addToast(err instanceof Error ? err.message : 'Erro ao classificar.', 'error');
      },
    });
  };

  return (
    <div className="border-b border-slate-200 dark:border-white/10 py-3 px-1">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
        Classificar
      </p>

      {state.currentBoardName ? (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Funil actual: <span className="font-semibold text-slate-700 dark:text-slate-200">{state.currentBoardName}</span>
        </p>
      ) : (
        <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
          Ainda sem negócio. Escolha o funil para criar a lead.
        </p>
      )}

      {showContinuityHint && (
        <div className="flex items-start gap-2 mb-2 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-2.5 py-2">
          <Sparkles className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-300">
            Este contacto já respondeu mais do que uma vez. Classifique-o para o tornar uma lead.
          </p>
        </div>
      )}

      {suggestedFunnel && suggestedFunnel !== currentFunnel && (
        <div className="flex items-start gap-2 mb-2 rounded-lg bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/20 px-2.5 py-2">
          <Sparkles className="w-3.5 h-3.5 text-primary-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-primary-700 dark:text-primary-300">
            Sugestão IA: parece <span className="font-semibold">{suggestedLabel}</span>
            {suggestion?.reason ? ` — ${suggestion.reason}` : ''}
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-1.5">
        {FUNNELS.map(({ key, label, icon: Icon }) => {
          const isCurrent = currentFunnel === key;
          const isSuggested = !isCurrent && suggestedFunnel === key;
          return (
            <button
              key={key}
              type="button"
              disabled={classify.isPending}
              onClick={() => handleClassify(key)}
              className={cn(
                'inline-flex flex-col items-center justify-center gap-1 px-2 py-2.5 rounded-lg text-xs font-medium transition-colors',
                isCurrent
                  ? 'bg-primary-600 text-white'
                  : 'bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10',
                isSuggested && 'ring-2 ring-primary-400 dark:ring-primary-500',
                classify.isPending && 'opacity-50 cursor-not-allowed'
              )}
              title={isCurrent ? `Já está em ${label}` : isSuggested ? `Sugestão da IA: ${label}` : `Classificar como ${label}`}
            >
              {classify.isPending && classify.variables === key ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Icon className="w-4 h-4" />
              )}
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default ConversationClassifier;
