'use client';

import React from 'react';
import { X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FocusTrap, useFocusReturn } from '@/lib/a11y';
import { queryKeys } from '@/lib/query/queryKeys';
import { ActivityLogForm, type ActivityLogPayload } from './ActivityLogForm';
import { ActivityHistory, type ActivityEntry } from './ActivityHistory';

interface DealActivityModalProps {
  dealId: string;
  contactName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

async function fetchEntries(dealId: string): Promise<ActivityEntry[]> {
  const res = await fetch(`/api/deals/${dealId}/activities`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error('Falha ao carregar histórico');
  const body = await res.json();
  return (body?.entries ?? []) as ActivityEntry[];
}

export function DealActivityModal({ dealId, contactName, open, onOpenChange }: DealActivityModalProps) {
  const headingId = React.useId();
  const qc = useQueryClient();
  useFocusReturn({ enabled: open });
  const [busyDeleteId, setBusyDeleteId] = React.useState<string | null>(null);

  const { data: entries = [], isLoading } = useQuery({
    queryKey: queryKeys.dealActivities.byDeal(dealId),
    queryFn: () => fetchEntries(dealId),
    enabled: open,
    staleTime: 15_000,
  });

  const invalidate = React.useCallback(() => {
    qc.invalidateQueries({ queryKey: queryKeys.dealActivities.byDeal(dealId) });
    qc.invalidateQueries({ queryKey: queryKeys.dealQuickStats.all });
    qc.invalidateQueries({ queryKey: queryKeys.dealStates.all });
  }, [qc, dealId]);

  const logMutation = useMutation({
    mutationFn: async (payload: ActivityLogPayload) => {
      const res = await fetch(`/api/deals/${dealId}/activities`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error || 'Falha ao registar.');
      }
    },
    onSuccess: invalidate,
  });

  const remove = async (id: string) => {
    setBusyDeleteId(id);
    try {
      await fetch(`/api/deals/${dealId}/activities?activityId=${id}`, { method: 'DELETE' });
      invalidate();
    } finally {
      setBusyDeleteId(null);
    }
  };

  if (!open) return null;

  return (
    <FocusTrap active={open} onEscape={() => onOpenChange(false)}>
      <div
        className="fixed inset-0 md:left-[var(--app-sidebar-width,0px)] z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        onClick={(e) => {
          if (e.target === e.currentTarget) onOpenChange(false);
        }}
      >
        <div className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 max-h-[90dvh] overflow-y-auto">
          <div className="p-5 border-b border-slate-200 dark:border-white/10 flex justify-between items-start">
            <div>
              <h2 id={headingId} className="text-lg font-bold text-slate-900 dark:text-white font-display">
                Actividade
              </h2>
              {contactName && <p className="text-sm text-slate-500 dark:text-slate-400">{contactName}</p>}
            </div>
            <button
              onClick={() => onOpenChange(false)}
              aria-label="Fechar"
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white rounded"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="p-5">
            <ActivityLogForm
              onSubmit={(payload) => logMutation.mutateAsync(payload)}
              submitting={logMutation.isPending}
              onClose={() => onOpenChange(false)}
            />

            <div className="mt-6 pt-5 border-t border-slate-100 dark:border-white/5">
              <ActivityHistory
                heading={`Histórico (${entries.length})`}
                entries={entries}
                onDelete={remove}
                busyDeleteId={busyDeleteId}
              />
              {isLoading && <p className="text-xs text-slate-400 mt-2">A carregar…</p>}
            </div>
          </div>
        </div>
      </div>
    </FocusTrap>
  );
}
