'use client';

import React from 'react';
import { Facebook } from 'lucide-react';
import type { MetaAdAttribution } from '@/types';

/**
 * Mostra a origem do anúncio (Meta Ads) de uma lead/contacto/negócio.
 * Só renderiza quando há atribuição da fonte `meta_ads`. Read-only.
 */
export function MetaAttribution({ attribution }: { attribution?: MetaAdAttribution | null }) {
  if (!attribution || attribution.source !== 'meta_ads') return null;

  const platform =
    attribution.platform === 'ig'
      ? 'Instagram'
      : attribution.platform === 'fb'
        ? 'Facebook'
        : null;

  const rows: { label: string; value?: string | null }[] = [
    { label: 'Campanha', value: attribution.campaign_name || attribution.campaign_id },
    { label: 'Conjunto', value: attribution.adset_name || attribution.adset_id },
    { label: 'Anúncio', value: attribution.ad_name || attribution.ad_id },
    { label: 'Formulário', value: attribution.form_name || attribution.form_id },
    { label: 'Plataforma', value: platform },
  ].filter((r) => r.value);

  return (
    <div className="rounded-xl border border-blue-200 dark:border-blue-500/20 bg-blue-50 dark:bg-blue-500/10 p-3">
      <h3 className="text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Facebook className="w-3.5 h-3.5" />
        Origem do anúncio (Meta Ads)
      </h3>
      {rows.length > 0 ? (
        <dl className="space-y-1">
          {rows.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-3 text-xs">
              <dt className="text-blue-600/80 dark:text-blue-300/70 shrink-0">{r.label}</dt>
              <dd className="text-blue-900 dark:text-blue-100 font-medium text-right break-words">{r.value}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="text-xs text-blue-700 dark:text-blue-300">
          Lead proveniente de um anúncio Meta (sem detalhes da campanha).
        </p>
      )}
    </div>
  );
}
