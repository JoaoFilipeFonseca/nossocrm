'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { MessageCircle, Copy, RefreshCw, Check, ExternalLink, ArrowLeft, Sparkles, Lock } from 'lucide-react';

interface Conversation {
  id: string;
  platform: string;
  participant_name: string | null;
  last_snippet: string | null;
  last_message_at: string | null;
  last_from: string | null;
  needs_response: boolean;
  status: string;
  is_noise: boolean;
  contact_id: string | null;
  deal_id: string | null;
  ai_draft: string | null;
  ai_draft_at: string | null;
}
interface Message {
  id: string;
  from_side: string;
  body: string | null;
  sent_at: string | null;
}

const MESSENGER_INBOX = 'https://business.facebook.com/latest/inbox/';

function ago(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff)) return '';
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'ontem';
  return `há ${d} dias`;
}

function initials(name: string | null): string {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
}

export function SocialInboxPage() {
  const [convs, setConvs] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'todos' | 'responder'>('responder');
  const [selId, setSelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [drafting, setDrafting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loadingThread, setLoadingThread] = useState(false);

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/social-inbox');
      const j = await r.json();
      setConvs(j.conversations ?? []);
    } catch {
      setConvs([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openThread = useCallback(async (id: string) => {
    setSelId(id);
    setLoadingThread(true);
    setMessages([]);
    setDraft('');
    try {
      const r = await fetch(`/api/social-inbox/${id}`);
      const j = await r.json();
      setMessages(j.messages ?? []);
      setDraft(j.conversation?.ai_draft ?? '');
    } catch {
      /* */
    }
    setLoadingThread(false);
  }, []);

  const generateDraft = useCallback(async () => {
    if (!selId) return;
    setDrafting(true);
    try {
      const r = await fetch(`/api/social-inbox/${selId}/draft`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const j = await r.json();
      if (j.ok && j.draft) setDraft(j.draft);
    } catch {
      /* */
    }
    setDrafting(false);
  }, [selId]);

  const setStatus = useCallback(
    async (status: string) => {
      if (!selId) return;
      try {
        await fetch(`/api/social-inbox/${selId}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
      } catch {
        /* */
      }
      setSelId(null);
      loadList();
    },
    [selId, loadList],
  );

  const copyDraft = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(draft);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* */
    }
  }, [draft]);

  const visible = convs.filter((c) => (filter === 'responder' ? c.needs_response && !c.is_noise && c.status === 'open' : true));
  const needsCount = convs.filter((c) => c.needs_response && !c.is_noise && c.status === 'open').length;
  const sel = convs.find((c) => c.id === selId) ?? null;

  return (
    <div className="p-4 md:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-xl font-bold flex items-center gap-2 font-display">
          <MessageCircle className="w-5 h-5 text-primary-500" /> Caixa Social
        </h1>
        {needsCount > 0 && (
          <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
            {needsCount} a precisar de resposta
          </span>
        )}
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        DMs do Facebook Messenger que precisam da tua atenção. A IA prepara o rascunho; tu revês e envias sempre.
      </p>

      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setFilter('responder')}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${filter === 'responder' ? 'bg-primary-500/15 border-primary-500/50 text-primary-700 dark:text-primary-200' : 'border-slate-200 dark:border-white/10 text-slate-500'}`}
        >
          A precisar de resposta ({needsCount})
        </button>
        <button
          onClick={() => setFilter('todos')}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${filter === 'todos' ? 'bg-primary-500/15 border-primary-500/50 text-primary-700 dark:text-primary-200' : 'border-slate-200 dark:border-white/10 text-slate-500'}`}
        >
          Todas
        </button>
        <button onClick={loadList} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 flex items-center gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Actualizar
        </button>
      </div>

      <div className="grid md:grid-cols-[360px_1fr] gap-4">
        {/* LISTA */}
        <div className={`bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-2xl overflow-hidden ${selId ? 'hidden md:block' : ''}`}>
          {loading ? (
            <div className="p-6 text-sm text-slate-400">A carregar...</div>
          ) : visible.length === 0 ? (
            <div className="p-6 text-sm text-slate-400">
              {filter === 'responder' ? 'Nada a precisar de resposta. Tudo em dia.' : 'Sem conversas ainda. Quando a sincronização correr, aparecem aqui.'}
            </div>
          ) : (
            visible.map((c) => (
              <button
                key={c.id}
                onClick={() => openThread(c.id)}
                className={`w-full text-left flex gap-3 p-3.5 border-b border-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors ${selId === c.id ? 'bg-primary-500/10' : ''}`}
              >
                <div className="w-10 h-10 rounded-full bg-primary-500/80 flex items-center justify-center text-white font-bold shrink-0">{initials(c.participant_name)}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex justify-between items-center gap-2">
                    <span className="font-semibold truncate">{c.participant_name || 'Contacto'}</span>
                    <span className="text-[11px] text-slate-400 whitespace-nowrap">{ago(c.last_message_at)}</span>
                  </div>
                  <div className="text-[12.5px] text-slate-500 dark:text-slate-400 truncate">{c.last_snippet || ''}</div>
                  <div className="flex items-center gap-1.5 mt-1">
                    {c.needs_response && !c.is_noise && c.status === 'open' && <span className="w-2 h-2 rounded-full bg-amber-500" />}
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-600 dark:text-sky-300">Messenger</span>
                    {c.is_noise && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-400/15 text-slate-500">ruído</span>}
                    {c.status === 'handled' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-500/15 text-green-600 dark:text-green-300">tratada</span>}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>

        {/* CONVERSA */}
        <div className={`bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-2xl flex flex-col min-h-[480px] ${selId ? '' : 'hidden md:flex'}`}>
          {!sel ? (
            <div className="flex-1 flex items-center justify-center text-sm text-slate-400 p-6 text-center">Escolhe uma conversa à esquerda.</div>
          ) : (
            <>
              <div className="p-4 border-b border-slate-200 dark:border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-3 min-w-0">
                  <button onClick={() => setSelId(null)} className="md:hidden text-slate-400">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <div className="w-9 h-9 rounded-full bg-primary-500/80 flex items-center justify-center text-white font-bold shrink-0">{initials(sel.participant_name)}</div>
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{sel.participant_name || 'Contacto'}</div>
                    <div className="text-[11px] text-slate-400">Facebook Messenger</div>
                  </div>
                </div>
                {sel.contact_id && (
                  <a href={`/contacts/${sel.contact_id}`} className="text-xs text-primary-500 hover:underline whitespace-nowrap">
                    Abrir contacto ↗
                  </a>
                )}
              </div>

              <div className="flex-1 p-4 flex flex-col gap-2.5 overflow-auto max-h-[340px]">
                {loadingThread ? (
                  <div className="text-sm text-slate-400">A carregar...</div>
                ) : messages.length === 0 ? (
                  <div className="text-sm text-slate-400">Sem mensagens guardadas.</div>
                ) : (
                  messages.map((m) => (
                    <div
                      key={m.id}
                      className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-[13.5px] ${m.from_side === 'us' ? 'self-end bg-primary-500/20 rounded-br-sm' : 'self-start bg-slate-100 dark:bg-slate-800 rounded-bl-sm'}`}
                    >
                      {m.body}
                      <div className="text-[10px] text-slate-400 mt-1">{ago(m.sent_at)}</div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-slate-200 dark:border-white/10 p-4 bg-slate-50 dark:bg-white/[0.03]">
                <div className="text-[11px] font-bold text-amber-600 dark:text-amber-300 uppercase tracking-wide flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3.5 h-3.5" /> Rascunho da IA (no teu tom)
                </div>
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder='Carrega em "Gerar rascunho" para a IA preparar uma resposta a esta conversa.'
                  className="w-full min-h-[92px] bg-white dark:bg-bg border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-amber-500/40"
                />
                <div className="flex flex-wrap gap-2 mt-2.5">
                  <button onClick={generateDraft} disabled={drafting} className="text-sm font-bold px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> {drafting ? 'A preparar...' : draft ? 'Outra versão' : 'Gerar rascunho'}
                  </button>
                  <a href={MESSENGER_INBOX} target="_blank" rel="noopener noreferrer" className="text-sm font-bold px-3.5 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center gap-1.5">
                    <ExternalLink className="w-4 h-4" /> Abrir no Messenger
                  </a>
                  <button onClick={copyDraft} disabled={!draft} className="text-sm font-bold px-3.5 py-2 rounded-lg border border-slate-200 dark:border-white/10 disabled:opacity-40 flex items-center gap-1.5">
                    {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />} {copied ? 'Copiado' : 'Copiar'}
                  </button>
                  <button onClick={() => setStatus('handled')} className="text-sm font-semibold px-3.5 py-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 flex items-center gap-1.5">
                    <Check className="w-4 h-4" /> Marcar tratada
                  </button>
                </div>
                <div className="text-[11.5px] text-slate-400 mt-2.5 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" /> A IA nunca envia. O rascunho é teu para reveres e enviares.
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default SocialInboxPage;
