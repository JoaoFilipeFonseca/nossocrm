'use client';

// Pesquisa global (Ctrl+K / Cmd+K) — contacto, negócio ou imóvel de qualquer
// página. Montado uma vez no Layout. Abre por atalho ou pelo evento
// 'foco:search:open' (disparado pelo botão da lupa). Copy PT-PT pré-AO 1990.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, User, Briefcase, Home, X, Loader2 } from 'lucide-react';
import type { SearchContact, SearchDeal, SearchImovel } from '@/app/api/search/route';

export const openGlobalSearch = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('foco:search:open'));
};

type Flat =
  | { kind: 'contact'; id: string; primary: string; secondary: string }
  | { kind: 'deal'; id: string; primary: string; secondary: string }
  | { kind: 'imovel'; id: string; primary: string; secondary: string };

const eur = (v: number | null) =>
  v && v > 0 ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v) : '';

export const GlobalSearchModal: React.FC = () => {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<SearchContact[]>([]);
  const [deals, setDeals] = useState<SearchDeal[]>([]);
  const [imoveis, setImoveis] = useState<SearchImovel[]>([]);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery('');
    setContacts([]);
    setDeals([]);
    setImoveis([]);
    setActive(0);
  }, []);

  // Abertura: atalho de teclado + evento da lupa.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('foco:search:open', onOpen as EventListener);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('foco:search:open', onOpen as EventListener);
    };
  }, []);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]);

  // Pesquisa com debounce.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setContacts([]);
      setDeals([]);
      setImoveis([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: 'no-store', signal: ctrl.signal });
        const data = await res.json();
        setContacts(data.contacts ?? []);
        setDeals(data.deals ?? []);
        setImoveis(data.imoveis ?? []);
        setActive(0);
      } catch {
        /* abortado ou rede */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  const flat = useMemo<Flat[]>(() => {
    const items: Flat[] = [];
    for (const c of contacts) items.push({ kind: 'contact', id: c.id, primary: c.name || 'Sem nome', secondary: c.phone || c.email || '' });
    for (const d of deals) items.push({ kind: 'deal', id: d.id, primary: d.title || 'Negócio', secondary: [d.contact_name, eur(d.value)].filter(Boolean).join(' · ') });
    for (const i of imoveis)
      items.push({ kind: 'imovel', id: i.id, primary: [i.tipologia, i.morada || i.concelho].filter(Boolean).join(' · ') || i.referencia || 'Imóvel', secondary: i.referencia || '' });
    return items;
  }, [contacts, deals, imoveis]);

  const go = useCallback(
    (item: Flat) => {
      close();
      if (item.kind === 'contact') router.push(`/contacts/${item.id}`);
      else if (item.kind === 'deal') router.push(`/boards?deal=${item.id}`);
      else router.push(`/imoveis/${item.id}`);
    },
    [router, close],
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(0, flat.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flat[active]) go(flat[active]);
    }
  };

  if (!open) return null;

  const hasQuery = query.trim().length >= 2;
  const empty = hasQuery && !loading && flat.length === 0;
  let idx = -1;

  const Group = ({
    label,
    kind,
    items,
    render,
  }: {
    label: string;
    kind: Flat['kind'];
    items: { id: string }[];
    render: (it: { id: string }) => { primary: string; secondary: string };
  }) => {
    if (items.length === 0) return null;
    const Icon = kind === 'contact' ? User : kind === 'deal' ? Briefcase : Home;
    return (
      <div className="py-1.5">
        <div className="px-4 py-1 text-[10.5px] font-bold uppercase tracking-wide text-slate-400 dark:text-slate-500">{label}</div>
        {items.map((it) => {
          idx += 1;
          const myIdx = idx;
          const r = render(it);
          const isActive = myIdx === active;
          return (
            <button
              key={`${kind}-${it.id}`}
              type="button"
              onMouseEnter={() => setActive(myIdx)}
              onClick={() => go({ kind, id: it.id, primary: r.primary, secondary: r.secondary } as Flat)}
              className={`w-full flex items-center gap-3 px-4 py-2 text-left ${
                isActive ? 'bg-primary-50 dark:bg-primary-500/10' : ''
              }`}
            >
              <Icon size={15} className="text-slate-400 dark:text-slate-500 shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm text-slate-800 dark:text-slate-100 truncate">{r.primary}</span>
                {r.secondary && <span className="block text-xs text-slate-400 dark:text-slate-500 truncate">{r.secondary}</span>}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-start justify-center pt-[12vh] px-4" onClick={close}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-100 dark:border-white/10">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Pesquisar contacto, negócio ou imóvel…"
            className="flex-1 bg-transparent outline-none text-sm text-slate-900 dark:text-white placeholder-slate-400"
          />
          {loading && <Loader2 size={16} className="animate-spin text-slate-400" />}
          <button onClick={close} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {!hasQuery && (
            <p className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">Escreve pelo menos 2 letras.</p>
          )}
          {empty && <p className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">Nada encontrado para “{query.trim()}”.</p>}
          <Group label="Contactos" kind="contact" items={contacts} render={(it) => {
            const c = it as SearchContact;
            return { primary: c.name || 'Sem nome', secondary: c.phone || c.email || '' };
          }} />
          <Group label="Negócios" kind="deal" items={deals} render={(it) => {
            const d = it as SearchDeal;
            return { primary: d.title || 'Negócio', secondary: [d.contact_name, eur(d.value)].filter(Boolean).join(' · ') };
          }} />
          <Group label="Imóveis" kind="imovel" items={imoveis} render={(it) => {
            const i = it as SearchImovel;
            return { primary: [i.tipologia, i.morada || i.concelho].filter(Boolean).join(' · ') || i.referencia || 'Imóvel', secondary: i.referencia || '' };
          }} />
        </div>

        <div className="px-4 py-2 border-t border-slate-100 dark:border-white/10 flex items-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
          <span>↑↓ navegar</span>
          <span>↵ abrir</span>
          <span>Esc fechar</span>
        </div>
      </div>
    </div>
  );
};

export default GlobalSearchModal;
