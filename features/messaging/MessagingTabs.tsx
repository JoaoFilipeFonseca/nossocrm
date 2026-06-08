'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { MessageSquare, MessageCircle } from 'lucide-react';
import { MessagingPage } from './MessagingPage';
import { SocialInboxPage } from '@/features/social-inbox/SocialInboxPage';

/**
 * Mensagens com duas abas: "Conversas" (inbox actual) e "Caixa Social" (DMs do Messenger).
 * Evita mais um item na barra lateral — a Caixa Social vive aqui dentro. Aba por `?tab=social`.
 */
export function MessagingTabs({ initialConversationId }: { initialConversationId?: string } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get('tab') === 'social' ? 'social' : 'conversas';

  const go = (t: 'conversas' | 'social') => {
    router.push(t === 'social' ? '/messaging?tab=social' : '/messaging', { scroll: false });
  };

  const tabCls = (active: boolean) =>
    `flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold rounded-t-lg border-b-2 transition-colors ${
      active
        ? 'border-primary-500 text-primary-600 dark:text-primary-300'
        : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
    }`;

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex gap-1 px-3 pt-1.5 border-b border-slate-200 dark:border-white/10 shrink-0">
        <button type="button" onClick={() => go('conversas')} className={tabCls(tab === 'conversas')}>
          <MessageSquare className="w-4 h-4" /> Conversas
        </button>
        <button type="button" onClick={() => go('social')} className={tabCls(tab === 'social')}>
          <MessageCircle className="w-4 h-4" /> Caixa Social
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {tab === 'social' ? <SocialInboxPage /> : <MessagingPage initialConversationId={initialConversationId} />}
      </div>
    </div>
  );
}

export default MessagingTabs;
