'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Phone, Users, MapPin, MessageCircle, Mail, Search, X, Briefcase, UserCircle2, Check } from 'lucide-react';
import { useDeals } from '@/lib/query/hooks/useDealsQuery';
import { useContacts } from '@/lib/query/hooks/useContactsQuery';
import { useToast } from '@/context/ToastContext';

type ChqType = 'call' | 'meeting' | 'visit' | 'whatsapp' | 'email';

const TYPES: { key: ChqType; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
  { key: 'call', label: 'Chamada', icon: Phone },
  { key: 'meeting', label: 'Reunião', icon: Users },
  { key: 'visit', label: 'Visita', icon: MapPin },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { key: 'email', label: 'Email', icon: Mail },
];

const HIDDEN_ROUTES = ['/login', '/setup', '/labs'];

type Target = { kind: 'deal'; id: string; label: string } | { kind: 'contact'; id: string; label: string };

/**
 * Sprint 13 c3 — FAB global para registar CHQ de qualquer ecrã do CRM.
 * Posicionado fixed bottom-right. Modal compacto com tabs Deal/Contacto +
 * pesquisa + 5 botões de tipo. Não substitui LogCHQQuick contextual; é o
 * fallback para quando o utilizador está fora de um deal específico (ex.
 * acabou de desligar uma chamada feita do telemóvel, abre o CRM, regista).
 */
export const CHQFloatingButton: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'deal' | 'contact'>('deal');
  const [query, setQuery] = useState('');
  const [target, setTarget] = useState<Target | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { addToast } = useToast();

  const { data: deals = [] } = useDeals();
  const { data: contacts = [] } = useContacts();

  // Esconder em rotas de login/setup/labs
  const [pathname, setPathname] = useState<string>('');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setPathname(window.location.pathname);
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const hidden = HIDDEN_ROUTES.some((r) => pathname.startsWith(r));

  const filteredDeals = useMemo(() => {
    const q = query.trim().toLowerCase();
    return deals
      .filter((d: any) => !d.isWon && !d.isLost)
      .filter((d: any) => !q || (d.title || '').toLowerCase().includes(q) || (d.contactName || '').toLowerCase().includes(q))
      .slice(0, 12);
  }, [deals, query]);

  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contacts
      .filter((c: any) => !q || (c.name || '').toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q) || (c.phone || '').includes(q))
      .slice(0, 12);
  }, [contacts, query]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      setQuery('');
      setTarget(null);
    }
  }, [open]);

  const submit = async (type: ChqType) => {
    if (!target) return;
    setSubmitting(true);
    try {
      const url = target.kind === 'deal'
        ? `/api/deals/${encodeURIComponent(target.id)}/activities`
        : `/api/contacts/${encodeURIComponent(target.id)}/activities`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type, metadata: { via: 'chq-floating-button' } }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast(json.error || 'Erro a registar CHQ', 'error');
        return;
      }
      addToast(`✓ ${TYPES.find((t) => t.key === type)?.label} registada para ${target.label}`, 'success');
      setOpen(false);
    } catch (e) {
      addToast((e as Error).message || 'Erro de rede', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (hidden) return null;

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Registar CHQ rápido"
        aria-label="Registar Conversa Humana Qualificada"
        // Empilhado ACIMA do VoiceCaptureFAB para evitar sobreposicao (B-009).
        // Mobile: voice fica em safe+96px; CHQ a 72px acima (safe+168).
        // Desktop: voice fica em bottom-6 (24px); CHQ em bottom-24 (96px = 72px acima).
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 168px)' }}
        className="fixed z-40 md:!bottom-24 right-4 md:right-6 h-14 w-14 rounded-full bg-primary-600 hover:bg-primary-500 text-white shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
      >
        <Phone className="h-6 w-6" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-6"
          onClick={() => !submitting && setOpen(false)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full md:max-w-md md:rounded-2xl rounded-t-2xl border border-slate-200 dark:border-white/10 max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Registar CHQ</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {target ? `Em: ${target.label}` : 'Escolher deal ou contacto'}
                </p>
              </div>
              <button onClick={() => setOpen(false)} disabled={submitting} className="text-slate-400 hover:text-slate-700 dark:hover:text-white disabled:opacity-50">
                <X className="h-5 w-5" />
              </button>
            </header>

            {!target ? (
              <>
                {/* Tabs */}
                <div className="flex items-center gap-1 p-2 border-b border-slate-200 dark:border-white/10">
                  <button
                    onClick={() => setTab('deal')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                      tab === 'deal'
                        ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-200'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <Briefcase size={14} /> Deal
                  </button>
                  <button
                    onClick={() => setTab('contact')}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                      tab === 'contact'
                        ? 'bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-200'
                        : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                  >
                    <UserCircle2 size={14} /> Contacto
                  </button>
                </div>

                {/* Pesquisa */}
                <div className="p-3 border-b border-slate-200 dark:border-white/10">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      ref={inputRef}
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={tab === 'deal' ? 'Pesquisar deal por título…' : 'Nome, email ou telefone…'}
                      className="w-full pl-9 pr-3 py-2 text-sm rounded-md border border-slate-300 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>

                {/* Lista */}
                <div className="flex-1 overflow-y-auto p-2">
                  {tab === 'deal' && (
                    filteredDeals.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500 text-center">Sem deals abertos.</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {filteredDeals.map((d: any) => (
                          <li key={d.id}>
                            <button
                              onClick={() => setTarget({ kind: 'deal', id: d.id, label: d.title || 'Sem título' })}
                              className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-white/5 text-sm text-slate-700 dark:text-slate-200 flex items-center justify-between"
                            >
                              <span className="truncate">{d.title || 'Sem título'}</span>
                              {d.value > 0 && (
                                <span className="text-xs text-slate-400 ml-2 flex-shrink-0">{Math.round(d.value).toLocaleString('pt-PT')} €</span>
                              )}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                  {tab === 'contact' && (
                    filteredContacts.length === 0 ? (
                      <p className="p-4 text-sm text-slate-500 text-center">Sem contactos.</p>
                    ) : (
                      <ul className="space-y-0.5">
                        {filteredContacts.map((c: any) => (
                          <li key={c.id}>
                            <button
                              onClick={() => setTarget({ kind: 'contact', id: c.id, label: c.name || 'Sem nome' })}
                              className="w-full text-left px-3 py-2 rounded-md hover:bg-slate-100 dark:hover:bg-white/5 text-sm text-slate-700 dark:text-slate-200"
                            >
                              <div className="truncate">{c.name || 'Sem nome'}</div>
                              <div className="text-xs text-slate-400 truncate">
                                {c.phone || c.email || ''}
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Selector de tipo CHQ */}
                <div className="p-4 grid grid-cols-1 gap-2">
                  {TYPES.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => submit(t.key)}
                      disabled={submitting}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-white/10 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-500/10 text-left transition-colors disabled:opacity-50"
                    >
                      <t.icon size={18} className="text-primary-500" />
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{t.label}</span>
                      {submitting && <Check size={14} className="ml-auto animate-pulse text-emerald-500" />}
                    </button>
                  ))}
                </div>
                <div className="p-3 border-t border-slate-200 dark:border-white/10 flex justify-between">
                  <button
                    onClick={() => setTarget(null)}
                    disabled={submitting}
                    className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 disabled:opacity-50"
                  >
                    ← Voltar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
