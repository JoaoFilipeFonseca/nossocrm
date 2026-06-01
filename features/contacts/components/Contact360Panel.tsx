'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, RotateCw, Copy, Check, Pencil, X } from 'lucide-react';
import { toWhatsAppPhone } from '@/lib/phone';

type SuggestionField = 'disc' | 'triggers' | 'quarter' | 'familyMembers' | 'pets' | 'address';
interface Suggestion { campo: SuggestionField; valor: string; rotulo: string }

interface AssistantResult {
  retrato: string;
  sinais: string[];
  proximaAccao: { titulo: string; porque: string; confianca: 'alta' | 'media' | 'baixa' };
  mensagens: { whatsapp: string; email: { assunto: string; corpo: string } };
  sugestoes?: Suggestion[];
}

interface Contact360PanelProps {
  contactId: string;
  phone: string | null;
  email: string | null;
}

const CONF_META: Record<string, { label: string; cls: string }> = {
  alta: { label: 'confiança alta', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  media: { label: 'confiança média', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  baixa: { label: 'confiança baixa', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};

const FIELD_ICON: Record<SuggestionField, string> = {
  disc: '🎨', triggers: '⚡', quarter: '🗓️', familyMembers: '👨‍👩‍👧', pets: '🐾', address: '📍',
};

export function Contact360Panel({ contactId, phone, email }: Contact360PanelProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [data, setData] = React.useState<AssistantResult | null>(null);
  const [tab, setTab] = React.useState<'whatsapp' | 'email'>('whatsapp');
  const [waText, setWaText] = React.useState('');
  const [emailBody, setEmailBody] = React.useState('');
  const [editing, setEditing] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [suggestions, setSuggestions] = React.useState<Suggestion[]>([]);
  const [busyField, setBusyField] = React.useState<string | null>(null);

  const analyze = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contacts/${contactId}/assistant`, { method: 'POST' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Falha ao analisar.');
      const a = body.assistant as AssistantResult;
      setData(a);
      setWaText(a.mensagens.whatsapp);
      setEmailBody(a.mensagens.email.corpo);
      setSuggestions(a.sugestoes ?? []);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao analisar.');
    } finally {
      setLoading(false);
    }
  };

  const acceptSuggestion = async (s: Suggestion) => {
    const key = `${s.campo}:${s.valor}`;
    setBusyField(key);
    try {
      const res = await fetch(`/api/contacts/${contactId}/enrich`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ campo: s.campo, valor: s.valor }),
      });
      if (res.ok) {
        setSuggestions((prev) => prev.filter((x) => !(x.campo === s.campo && x.valor === s.valor)));
        router.refresh(); // actualiza o cartão "Sobre a pessoa"
      }
    } finally {
      setBusyField(null);
    }
  };

  const ignoreSuggestion = (s: Suggestion) => {
    setSuggestions((prev) => prev.filter((x) => !(x.campo === s.campo && x.valor === s.valor)));
  };

  const copyCurrent = async () => {
    const text = tab === 'whatsapp' ? waText : emailBody;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard indisponível */ }
  };

  const waHref = phone ? `https://wa.me/${toWhatsAppPhone(phone)}?text=${encodeURIComponent(waText)}` : null;
  const mailHref = email && data
    ? `mailto:${email}?subject=${encodeURIComponent(data.mensagens.email.assunto)}&body=${encodeURIComponent(emailBody)}`
    : null;

  return (
    <div className="rounded-2xl border border-primary-200 bg-gradient-to-b from-primary-50 to-white dark:from-primary-900/20 dark:to-dark-card dark:border-primary-500/20 shadow-sm overflow-hidden">
      <div className="px-5 py-3 flex items-center justify-between border-b border-primary-100 dark:border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary-600" />
          <h2 className="text-sm font-bold text-primary-800 dark:text-primary-200">Assistente 360</h2>
        </div>
        <button
          onClick={analyze}
          disabled={loading}
          className="text-xs font-semibold text-primary-600 hover:underline inline-flex items-center gap-1 disabled:opacity-50"
        >
          <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'A analisar...' : data ? 'Reanalisar' : 'Analisar com IA'}
        </button>
      </div>

      {!data && !loading && !error && (
        <div className="p-5 text-sm text-slate-600 dark:text-slate-300">
          A IA lê tudo o que o CRM sabe desta pessoa (perfil, família, triggers, anúncio de origem, negócios, actividade) e propõe o retrato, a próxima melhor acção e uma mensagem pronta no seu tom.
        </div>
      )}

      {error && <p className="px-5 py-4 text-sm text-rose-600">{error}</p>}

      {loading && !data && (
        <div className="p-5 space-y-2 animate-pulse">
          <div className="h-3 bg-slate-200 dark:bg-white/10 rounded w-3/4" />
          <div className="h-3 bg-slate-200 dark:bg-white/10 rounded w-full" />
          <div className="h-3 bg-slate-200 dark:bg-white/10 rounded w-2/3" />
        </div>
      )}

      {data && (
        <>
          {/* 1 — Retrato */}
          <div className="p-5 border-b border-slate-100 dark:border-white/5">
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">1 · Retrato</div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{data.retrato}</p>
            {data.sinais.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {data.sinais.map((s, i) => (
                  <span key={i} className="px-2 py-0.5 rounded-md text-xs bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300">{s}</span>
                ))}
              </div>
            )}
          </div>

          {/* 2 — Próxima melhor acção + mensagem */}
          <div className="p-5">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">2 · Próxima melhor acção</span>
              <span className={`text-[11px] border px-1.5 py-0.5 rounded ${CONF_META[data.proximaAccao.confianca]?.cls ?? CONF_META.baixa.cls}`}>
                {CONF_META[data.proximaAccao.confianca]?.label ?? 'confiança'}
              </span>
            </div>
            <div className="rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 p-3 mb-3">
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{data.proximaAccao.titulo}</div>
              <div className="text-xs text-slate-500 mt-1">{data.proximaAccao.porque}</div>
            </div>

            <div className="rounded-xl bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 overflow-hidden">
              <div className="flex items-center gap-1 px-2 pt-2">
                <button
                  onClick={() => { setTab('whatsapp'); setEditing(false); }}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${tab === 'whatsapp' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'text-slate-500 border-transparent hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >WhatsApp</button>
                <button
                  onClick={() => { setTab('email'); setEditing(false); }}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${tab === 'email' ? 'bg-primary-50 text-primary-700 border-primary-200' : 'text-slate-500 border-transparent hover:bg-slate-50 dark:hover:bg-white/5'}`}
                >Email</button>
                <span className="ml-auto text-[11px] text-slate-400 pr-1">no seu tom · PT-PT</span>
              </div>

              {tab === 'email' && (
                <div className="px-3 pt-2 text-xs text-slate-500">Assunto: <b className="text-slate-700 dark:text-slate-200">{data.mensagens.email.assunto}</b></div>
              )}

              {editing ? (
                <textarea
                  value={tab === 'whatsapp' ? waText : emailBody}
                  onChange={(e) => (tab === 'whatsapp' ? setWaText(e.target.value) : setEmailBody(e.target.value))}
                  rows={6}
                  className="m-3 w-[calc(100%-1.5rem)] bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 resize-y"
                />
              ) : (
                <div className="p-3 text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{tab === 'whatsapp' ? waText : emailBody}</div>
              )}

              <div className="flex flex-wrap items-center gap-2 px-3 pb-3">
                {tab === 'whatsapp' && waHref && (
                  <a href={waHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-500">Enviar por WhatsApp</a>
                )}
                {tab === 'email' && mailHref && (
                  <a href={mailHref} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold bg-primary-600 text-white hover:bg-primary-500">Abrir email</a>
                )}
                <button onClick={copyCurrent} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10">
                  {copied ? <><Check size={14} /> Copiado</> : <><Copy size={14} /> Copiar</>}
                </button>
                <button onClick={() => setEditing((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10">
                  <Pencil size={14} /> {editing ? 'Concluir' : 'Editar'}
                </button>
                <button onClick={analyze} disabled={loading} className="px-3 py-1.5 rounded-lg text-sm font-medium text-primary-600 hover:underline disabled:opacity-50">↻ Outra versão</button>
              </div>
            </div>
          </div>

          {/* 3 — Auto-enriquecimento */}
          {suggestions.length > 0 && (
            <div className="p-5 border-t border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">3 · Sugestões para a ficha</span>
                <span className="text-[11px] text-slate-400">a IA detectou nas interacções</span>
              </div>
              <ul className="space-y-2">
                {suggestions.map((s) => {
                  const key = `${s.campo}:${s.valor}`;
                  return (
                    <li key={key} className="flex items-center justify-between gap-3 rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 px-3 py-2">
                      <span className="text-sm text-slate-700 dark:text-slate-200 min-w-0 truncate"><span aria-hidden>{FIELD_ICON[s.campo]}</span> {s.rotulo}</span>
                      <span className="flex gap-1.5 shrink-0">
                        <button onClick={() => acceptSuggestion(s)} disabled={busyField === key} className="text-xs font-semibold px-2 py-1 rounded-md bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50">
                          {busyField === key ? '...' : 'Aceitar'}
                        </button>
                        <button onClick={() => ignoreSuggestion(s)} disabled={busyField === key} className="text-xs px-2 py-1 rounded-md bg-slate-100 dark:bg-white/10 text-slate-500 dark:text-slate-300 border border-slate-200 dark:border-white/10 inline-flex items-center gap-1">
                          <X size={12} /> Ignorar
                        </button>
                      </span>
                    </li>
                  );
                })}
              </ul>
              <p className="text-[11px] text-slate-400 mt-2">Nada muda na ficha sem a tua validação. Ao aceitar, grava nos campos da pessoa.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
