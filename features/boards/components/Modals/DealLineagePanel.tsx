'use client';

/**
 * DealLineagePanel — linhagem de negócios (fundação MA-LTV).
 *
 * Um negócio pode derivar de outro (indicação numa visita, investidor que
 * compra mais, arrendamentos gerados durante uma pesquisa). Este painel:
 *  - liga o negócio aberto ao negócio que o originou ("Derivado de");
 *  - lista os negócios que este gerou ("Gerou");
 *  - soma o valor de TODA a linhagem (raiz + descendentes): ganho, em aberto
 *    e total, para o João ver quanto vale de facto a cadeia que nasceu de
 *    um negócio de 500 €.
 *
 * Os dados vêm do cache DEALS_VIEW (todos os negócios já carregados nos
 * Boards); a escrita usa o mutation normal de update (origin_deal_id).
 */

import React, { useMemo, useState } from 'react';
import { GitBranch, X, Plus, Trophy, CircleDollarSign } from 'lucide-react';
import { useDealsView, useUpdateDeal } from '@/lib/query/hooks';
import { DealView } from '@/types';

const eur = (v: number) => `${Math.round(v).toLocaleString('pt-PT')} €`;

/** Estado curto do negócio para o chip da lista. */
const dealState = (d: DealView): { label: string; cls: string } => {
  if (d.isWon) return { label: 'ganho', cls: 'text-emerald-600 dark:text-emerald-400' };
  if (d.isLost) return { label: 'perdido', cls: 'text-red-500 dark:text-red-400' };
  return { label: 'aberto', cls: 'text-sky-600 dark:text-sky-400' };
};

/** Sobe até à raiz da linhagem (com guarda contra ciclos). */
const findRoot = (deal: DealView, byId: Map<string, DealView>): DealView => {
  let current = deal;
  const visited = new Set<string>([deal.id]);
  while (current.originDealId) {
    const parent = byId.get(current.originDealId);
    if (!parent || visited.has(parent.id)) break;
    visited.add(parent.id);
    current = parent;
  }
  return current;
};

/** Recolhe a árvore inteira a partir da raiz (BFS, com guarda contra ciclos). */
const collectSubtree = (rootId: string, childrenOf: Map<string, DealView[]>, byId: Map<string, DealView>): DealView[] => {
  const out: DealView[] = [];
  const seen = new Set<string>();
  const queue = [rootId];
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const d = byId.get(id);
    if (d) out.push(d);
    for (const child of childrenOf.get(id) || []) queue.push(child.id);
  }
  return out;
};

interface DealLineagePanelProps {
  deal: DealView;
}

export const DealLineagePanel: React.FC<DealLineagePanelProps> = ({ deal }) => {
  const { data: allDeals = [] } = useDealsView();
  const updateDealMutation = useUpdateDeal();
  const [query, setQuery] = useState('');
  const [showPicker, setShowPicker] = useState(false);

  const byId = useMemo(() => new Map(allDeals.map(d => [d.id, d])), [allDeals]);
  const childrenOf = useMemo(() => {
    const m = new Map<string, DealView[]>();
    for (const d of allDeals) {
      if (!d.originDealId) continue;
      const arr = m.get(d.originDealId) || [];
      arr.push(d);
      m.set(d.originDealId, arr);
    }
    return m;
  }, [allDeals]);

  const origin = deal.originDealId ? byId.get(deal.originDealId) : undefined;
  const children = childrenOf.get(deal.id) || [];

  // Linhagem completa: da raiz para baixo. Só interessa mostrar se houver cadeia.
  const lineage = useMemo(() => {
    const root = findRoot(byId.get(deal.id) ?? deal, byId);
    return collectSubtree(root.id, childrenOf, byId);
  }, [deal, byId, childrenOf]);

  const totals = useMemo(() => {
    let won = 0, open = 0;
    for (const d of lineage) {
      if (d.isWon) won += d.value || 0;
      else if (!d.isLost) open += d.value || 0;
    }
    return { won, open, count: lineage.length };
  }, [lineage]);

  // Candidatos a "derivado de": nunca o próprio nem os seus descendentes (evita ciclos).
  const descendantIds = useMemo(() => new Set(collectSubtree(deal.id, childrenOf, byId).map(d => d.id)), [deal.id, childrenOf, byId]);
  const q = query.trim().toLowerCase();
  const candidates = q.length < 2 ? [] : allDeals
    .filter(d => !descendantIds.has(d.id))
    .filter(d => d.title.toLowerCase().includes(q) || (d.contactName || '').toLowerCase().includes(q))
    .slice(0, 6);

  const setOrigin = (originId: string | null) => {
    updateDealMutation.mutate({ id: deal.id, updates: { originDealId: originId } });
    setQuery('');
    setShowPicker(false);
  };

  return (
    <div className="pt-3 border-t border-slate-100 dark:border-white/5">
      <div className="flex items-center gap-2 mb-2">
        <GitBranch size={12} className="text-slate-400" />
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Linhagem</span>
      </div>

      {/* Derivado de */}
      {origin ? (
        <div className="flex items-center gap-1.5 text-xs mb-1.5">
          <span className="text-slate-400 shrink-0">Derivado de:</span>
          <span className="truncate font-medium text-slate-700 dark:text-slate-200" title={origin.title}>{origin.title}</span>
          <button
            type="button"
            onClick={() => setOrigin(null)}
            className="ml-auto shrink-0 text-slate-400 hover:text-red-500 dark:hover:text-red-400"
            aria-label="Remover ligação ao negócio de origem"
            title="Remover ligação"
          >
            <X size={12} />
          </button>
        </div>
      ) : showPicker ? (
        <div className="mb-1.5">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Escape') { setShowPicker(false); setQuery(''); } }}
            placeholder="Procurar negócio de origem..."
            className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-md px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-primary-500 dark:text-white"
            aria-label="Procurar negócio de origem"
          />
          {candidates.length > 0 && (
            <div className="mt-1.5 bg-white dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-lg overflow-hidden">
              {candidates.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setOrigin(c.id)}
                  className="w-full text-left px-2.5 py-1.5 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                >
                  <span className="font-medium">{c.title}</span>
                  <span className="text-slate-400"> · {eur(c.value || 0)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowPicker(true)}
          className="inline-flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:underline mb-1.5"
        >
          <Plus size={12} /> Ligar ao negócio que o originou
        </button>
      )}

      {/* Gerou */}
      {children.length > 0 && (
        <div className="mt-1.5">
          <div className="text-[10px] uppercase tracking-wide text-slate-400 mb-1">Gerou {children.length} negócio{children.length > 1 ? 's' : ''}</div>
          <div className="space-y-1">
            {children.map(c => {
              const st = dealState(c);
              return (
                <div key={c.id} className="flex items-center gap-1.5 text-xs">
                  <span className="truncate text-slate-700 dark:text-slate-200" title={c.title}>{c.title}</span>
                  <span className={`ml-auto shrink-0 ${st.cls}`}>{st.label}</span>
                  <span className="shrink-0 text-slate-500 dark:text-slate-400">{eur(c.value || 0)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Total da linhagem (só quando existe cadeia) */}
      {totals.count > 1 && (
        <div className="mt-2 rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 px-2.5 py-2 text-xs space-y-1">
          <div className="text-[10px] uppercase tracking-wide text-slate-400">Valor da linhagem ({totals.count} negócios)</div>
          <div className="flex items-center gap-1.5">
            <Trophy size={12} className="text-emerald-500 shrink-0" />
            <span className="text-slate-500 dark:text-slate-400">Ganho:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{eur(totals.won)}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <CircleDollarSign size={12} className="text-sky-500 shrink-0" />
            <span className="text-slate-500 dark:text-slate-400">Em aberto:</span>
            <span className="font-semibold text-sky-600 dark:text-sky-400">{eur(totals.open)}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealLineagePanel;
