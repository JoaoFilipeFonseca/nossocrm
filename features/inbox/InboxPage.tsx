'use client'

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Phone, ArrowRight } from 'lucide-react';
import { useInboxController } from './hooks/useInboxController';
import { ViewModeToggle } from './components/ViewModeToggle';
import { InboxOverviewView } from './components/InboxOverviewView';
import { InboxListView } from './components/InboxListView';
import { InboxFocusView } from './components/InboxFocusView';
import { DebugFillButton } from '@/components/debug/DebugFillButton';

/**
 * Componente React `InboxPage`.
 * @returns {Element} Retorna um valor do tipo `Element`.
 */
export const InboxPage: React.FC = () => {
  const router = useRouter();

  // Controla “intenção” ao abrir a Lista (ex.: abrir já com sugestões expandidas)
  const [listPreset, setListPreset] = useState<'default' | 'suggestions-expanded'>('default');

  const {
    // View Mode
    viewMode,
    setViewMode,

    // Atividades
    overdueActivities,
    todayMeetings,
    todayTasks,
    upcomingActivities,

    // Sugestões IA
    aiSuggestions,

    // Focus Mode
    focusQueue,
    focusIndex,
    setFocusIndex,
    currentFocusItem,
    handleFocusNext,
    handleFocusPrev,
    handleFocusSkip,
    handleFocusDone,
    handleFocusSnooze,

    // Handlers Atividades
    handleCompleteActivity,
    handleSnoozeActivity,
    handleDiscardActivity,

    // Handlers Sugestões
    handleAcceptSuggestion,
    handleDismissSuggestion,
    handleSnoozeSuggestion,
    seedInboxDebug,
  } = useInboxController();

  const listDefaults = useMemo(
    () => ({
      suggestionsDefaultOpen: true,
      suggestionsDefaultShowAll: listPreset === 'suggestions-expanded',
    }),
    [listPreset]
  );

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display text-slate-900 dark:text-white mb-1">
            Inbox
          </h1>
          <p className="text-slate-500 dark:text-slate-400">A sua mesa de trabalho.</p>
          <div className="mt-4 flex gap-2">
            <DebugFillButton onClick={seedInboxDebug} label="Seed Inbox" variant="secondary" />
          </div>
        </div>

        <ViewModeToggle mode={viewMode} onChange={setViewMode} />
      </div>

      {/* Power List do dia — atalho para /hoje (sem inchar a barra lateral) */}
      <Link
        href="/hoje"
        className="group mb-6 flex items-center justify-between gap-3 rounded-xl border border-primary-200 dark:border-primary-500/30 bg-primary-50 dark:bg-primary-500/10 px-4 py-3 transition-colors hover:bg-primary-100 dark:hover:bg-primary-500/15"
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white">
            <Phone size={17} />
          </span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">A sua Power List de hoje</div>
            <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
              Os contactos a ligar agora, por prioridade, com a primeira frase pronta.
            </div>
          </div>
        </div>
        <ArrowRight size={18} className="flex-shrink-0 text-primary-600 dark:text-primary-300 transition-transform group-hover:translate-x-0.5" />
      </Link>

      {/* Views */}
      {viewMode === 'overview' ? (
        <InboxOverviewView
          overdueActivities={overdueActivities}
          todayMeetings={todayMeetings}
          todayTasks={todayTasks}
          upcomingActivities={upcomingActivities}
          aiSuggestions={aiSuggestions}
          onGoToList={() => {
            setListPreset('default');
            setViewMode('list');
          }}
          onStartFocus={() => {
            setFocusIndex(0);
            setViewMode('focus');
          }}
          onAcceptSuggestion={handleAcceptSuggestion}

          onOpenOverdue={() => router.push('/activities?filter=overdue')}
          onOpenToday={() => router.push('/activities?filter=today')}
          onOpenCriticalSuggestions={() => {
            setListPreset('suggestions-expanded');
            setViewMode('list');
          }}
          onOpenPending={() => {
            setListPreset('default');
            setViewMode('list');
          }}
        />
      ) : viewMode === 'list' ? (
        <InboxListView
          overdueActivities={overdueActivities}
          todayMeetings={todayMeetings}
          todayTasks={todayTasks}
          upcomingActivities={upcomingActivities}
          aiSuggestions={aiSuggestions}
          onCompleteActivity={handleCompleteActivity}
          onSnoozeActivity={handleSnoozeActivity}
          onDiscardActivity={handleDiscardActivity}
          onAcceptSuggestion={handleAcceptSuggestion}
          onDismissSuggestion={handleDismissSuggestion}
          onSnoozeSuggestion={handleSnoozeSuggestion}
          suggestionsDefaultOpen={listDefaults.suggestionsDefaultOpen}
          suggestionsDefaultShowAll={listDefaults.suggestionsDefaultShowAll}
          onSelectActivity={(id) => {
            const index = focusQueue.findIndex(item => item.id === id);
            if (index !== -1) {
              setFocusIndex(index);
              setViewMode('focus');
            }
          }}
        />
      ) : (
        <InboxFocusView
          currentItem={currentFocusItem}
          currentIndex={focusIndex}
          totalItems={focusQueue.length}
          onDone={handleFocusDone}
          onSnooze={handleFocusSnooze}
          onSkip={handleFocusSkip}
          onPrev={handleFocusPrev}
          onNext={handleFocusNext}
        />
      )}
    </div>
  );
};
