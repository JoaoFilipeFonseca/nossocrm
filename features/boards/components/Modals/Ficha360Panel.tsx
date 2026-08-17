'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query/queryKeys';
import { MetaAttribution } from '@/components/MetaAttribution';
import { ActivityHistory, type ActivityEntry } from '@/components/activity/ActivityHistory';
import type { Contact, DealView, DiscProfile } from '@/types';

/**
 * FICHA 360 — toda a informação do contacto dentro do negócio, num só scroll.
 * (Aprovado pelo João a 17 Ago: mínimo de toques; sem limitar os dados.)
 *
 * Fontes de verdade:
 * - `contact.notes` — respostas de questionários/formulários (Meta Ads e LPs
 *   escrevem aqui as respostas) + notas manuais.
 * - `contact.customFields` — campos ricos CT-1 (morada, família, gatilhos, DISC…).
 * - `contact.attribution` / `deal.attribution` + `contact.source` — de onde veio.
 * - `/api/deals/[id]/activities` — histórico 👤/🤖 (mesma query do DealActivityModal,
 *   partilha a cache `dealActivities.byDeal`).
 */

const DISC_LABEL: Record<DiscProfile, string> = {
  D: 'D — Dominante',
  I: 'I — Influente',
  S: 'S — Estável',
  C: 'C — Consciencioso',
};

async function fetchEntries(dealId: string): Promise<ActivityEntry[]> {
  const res = await fetch(`/api/deals/${dealId}/activities`, { headers: { accept: 'application/json' } });
  if (!res.ok) throw new Error('Falha ao carregar histórico');
  const body = await res.json();
  return (body?.entries ?? []) as ActivityEntry[];
}

function Card({ title, children }: { title: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm py-0.5">
      <dt className="text-slate-500 dark:text-slate-400 shrink-0">{label}</dt>
      <dd className="m-0 font-medium text-slate-900 dark:text-white text-right break-words min-w-0">{value}</dd>
    </div>
  );
}

export function Ficha360Panel({ deal, contact }: { deal: DealView; contact: Contact | null }) {
  const { data: entries = [], isLoading: historyLoading } = useQuery({
    queryKey: queryKeys.dealActivities.byDeal(deal.id),
    queryFn: () => fetchEntries(deal.id),
    staleTime: 15_000,
  });

  const cf = contact?.customFields ?? null;
  const hasRichFields = !!(cf && (cf.address || cf.familyMembers || cf.pets || (cf.triggers?.length) || cf.disc || cf.quarter));
  const notes = (contact?.notes ?? '').trim();

  const attribution = contact?.attribution ?? deal.attribution ?? null;
  const capturedAt = contact?.createdAt
    ? new Date(contact.createdAt).toLocaleString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Lisbon' })
    : null;

  return (
    <>
      {/* O QUE PEDIU — respostas de questionário/formulário + notas do contacto */}
      <Card title="📋 O que pediu · Notas do contacto">
        {notes ? (
          <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-line break-words">{notes}</p>
        ) : (
          <p className="text-sm text-slate-400 italic">Sem respostas de questionário ou notas ainda.</p>
        )}
        {hasRichFields && (
          <dl className={`space-y-0.5 ${notes ? 'mt-4 pt-3 border-t border-slate-100 dark:border-white/5' : ''}`}>
            {cf?.address && <Row label="Morada / Investimento" value={cf.address} />}
            {cf?.familyMembers && <Row label="Família" value={cf.familyMembers} />}
            {cf?.pets && <Row label="Animais" value={cf.pets} />}
            {!!cf?.triggers?.length && <Row label="Gatilhos" value={cf.triggers.join(' · ')} />}
            {cf?.disc && <Row label="Perfil DISC" value={DISC_LABEL[cf.disc]} />}
            {cf?.quarter && <Row label="Trimestre-alvo" value={cf.quarter} />}
          </dl>
        )}
      </Card>

      {/* DE ONDE VEIO — atribuição completa (muito importante para o João) */}
      <Card title="📣 De onde veio">
        <MetaAttribution attribution={attribution} />
        <dl className={`space-y-0.5 ${attribution?.source === 'meta_ads' ? 'mt-3' : ''}`}>
          {contact?.source && <Row label="Fonte" value={contact.source} />}
          {capturedAt && <Row label="Captada em" value={capturedAt} />}
          {!contact?.source && !attribution && (
            <p className="text-sm text-slate-400 italic">Sem origem registada.</p>
          )}
        </dl>
      </Card>

      {/* HISTÓRICO — interacções 👤/🤖 no mesmo scroll (leitura; registar fica no botão "Registar contacto") */}
      <Card title="🕘 Histórico de interacções">
        {historyLoading ? (
          <p className="text-sm text-slate-400">A carregar…</p>
        ) : (
          <ActivityHistory entries={entries} />
        )}
      </Card>
    </>
  );
}
