'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Home } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase/client';

export interface ImovelLite {
  id: string;
  referencia: string | null;
  morada: string | null;
  tipologia: string | null;
  concelho: string | null;
  tipo: string | null;
}

export function imovelLabel(i: ImovelLite): string {
  if (i.referencia) return `Ref. ${i.referencia}`;
  if (i.morada) return i.morada;
  return [i.tipo, i.tipologia].filter(Boolean).join(' ') || 'Imóvel';
}

export function useImoveisLite() {
  return useQuery({
    queryKey: ['imoveis', 'picker'],
    queryFn: async (): Promise<ImovelLite[]> => {
      if (!supabase) return [];
      const { data, error } = await supabase
        .from('imoveis')
        .select('id, referencia, morada, tipologia, concelho, tipo')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ImovelLite[];
    },
    staleTime: 60_000,
  });
}

interface Props {
  onSelect: (imovel: ImovelLite) => void;
  placeholder?: string;
}

/** Combobox de busca de imóvel (referência, morada, concelho, tipologia). AUD-A1. */
export function ImovelSearchCombobox({ onSelect, placeholder = 'Procurar imóvel (referência, morada, concelho)…' }: Props) {
  const { data: imoveis = [] } = useImoveisLite();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const results = useMemo(() => {
    const t = term.toLowerCase().trim();
    if (!t) return [];
    return imoveis
      .filter((i) => [i.referencia, i.morada, i.tipologia, i.concelho, i.tipo].some((f) => f?.toLowerCase().includes(t)))
      .slice(0, 8);
  }, [imoveis, term]);

  return (
    <div className="relative" ref={boxRef}>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => term && setOpen(true)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>
      {open && term.trim() && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
          {results.length > 0 ? (
            <div className="max-h-64 overflow-y-auto">
              {results.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => { onSelect(i); setTerm(''); setOpen(false); }}
                  className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <Home size={15} className="text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{imovelLabel(i)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {[i.morada, i.concelho].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="p-3 text-sm text-slate-500 dark:text-slate-400 text-center">Nenhum imóvel encontrado</div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Campo "Imóvel" para a ficha do negócio (AUD-A1): mostra o imóvel ligado (com
 * link) ou o combobox para ligar. `onLink(id|null)` grava/desliga.
 */
export function DealImovelField({ imovelId, onLink }: { imovelId: string | null; onLink: (id: string | null) => void }) {
  const { data: imoveis = [] } = useImoveisLite();
  const current = imovelId ? (imoveis.find((i) => i.id === imovelId) ?? null) : null;

  if (imovelId) {
    return (
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => window.open(`/imoveis/${imovelId}`, '_blank', 'noopener,noreferrer')}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline truncate"
        >
          <Home size={14} className="shrink-0" /> {current ? imovelLabel(current) : 'Ver imóvel'}
        </button>
        <button type="button" onClick={() => onLink(null)} className="text-xs text-red-600 hover:text-red-700 shrink-0">Desligar</button>
      </div>
    );
  }
  return <ImovelSearchCombobox onSelect={(i) => onLink(i.id)} />;
}
