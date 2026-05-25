'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mic, FileText, CheckCircle2, AlertCircle, ListChecks, MapPin, Smile, Frown, Meh, Lock } from 'lucide-react';

type Call = {
  id: string;
  deal_id: string | null;
  contact_id: string | null;
  status: string;
  transcript: string | null;
  summary: string | null;
  key_points: string[];
  next_actions: { title: string; urgency: 'low' | 'medium' | 'high'; type: string }[];
  decisions: string[];
  mentions: string[];
  sentiment: string | null;
  ai_model: string | null;
  ai_duration_ms: number | null;
  audio_size_bytes: number | null;
  audio_mime: string | null;
  duration_seconds: number | null;
  recorded_at: string | null;
  created_at: string;
  processed_at: string | null;
  error_message: string | null;
};

const SENTIMENT_META: Record<string, { label: string; cls: string; Icon: any }> = {
  positive:  { label: 'Positivo',     cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', Icon: Smile },
  neutral:   { label: 'Neutro',       cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-200', Icon: Meh },
  concerned: { label: 'Preocupado',   cls: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300', Icon: Frown },
  blocked:   { label: 'Bloqueado',    cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', Icon: Lock },
};

const URGENCY_CLS: Record<string, string> = {
  high:   'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30',
  medium: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  low:    'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
};

export const CallDetailPage: React.FC<{ id: string }> = ({ id }) => {
  const [call, setCall] = useState<Call | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCall = async () => {
    try {
      const res = await fetch(`/api/calls/${id}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Erro ${res.status}`);
      } else {
        setCall(data.call);
        setAudioUrl(data.audioUrl);
      }
    } catch (e: any) {
      setError(e?.message || 'Falhou');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCall(); }, [id]);

  // Poll while transcribing
  useEffect(() => {
    if (call?.status === 'transcribing' || call?.status === 'pending') {
      const t = setInterval(fetchCall, 4000);
      return () => clearInterval(t);
    }
  }, [call?.status]);

  if (loading) {
    return <div className="max-w-4xl mx-auto px-4 py-8 text-sm text-slate-500">A carregar…</div>;
  }
  if (error) {
    return <div className="max-w-4xl mx-auto px-4 py-8 text-sm text-rose-600">Erro: {error}</div>;
  }
  if (!call) return null;

  const sentMeta = SENTIMENT_META[call.sentiment || 'neutral'];

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-6 pb-16">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href={call.deal_id ? `/boards` : '/dashboard'} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Mic className="h-5 w-5 text-primary-600" />
          Chamada
        </h1>
        {call.sentiment && sentMeta && (
          <span className={`ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs ${sentMeta.cls}`}>
            <sentMeta.Icon className="h-3.5 w-3.5" />
            {sentMeta.label}
          </span>
        )}
      </div>

      {/* Status banner */}
      {call.status === 'transcribing' && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 text-sm text-blue-800 dark:text-blue-200">
          A transcrever e analisar… a página actualiza automaticamente.
        </div>
      )}
      {call.status === 'failed' && (
        <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-sm text-rose-700 dark:text-rose-300 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>
            Processamento falhou.
            {call.error_message && <div className="mt-1 font-mono text-xs">{call.error_message}</div>}
          </div>
        </div>
      )}

      {/* Audio player */}
      {audioUrl && (
        <div className="mb-6 p-4 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
          <audio controls className="w-full" src={audioUrl}>
            O seu browser não suporta audio.
          </audio>
          <div className="text-xs text-slate-400 mt-2">
            {call.audio_mime} · {call.audio_size_bytes ? `${(call.audio_size_bytes / 1024 / 1024).toFixed(1)} MB` : ''}
          </div>
        </div>
      )}

      {/* Summary */}
      {call.summary && (
        <section className="mb-6 p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-2">Sumário</h2>
          <p className="text-base text-slate-900 dark:text-white leading-relaxed">{call.summary}</p>
        </section>
      )}

      {/* Key points */}
      {call.key_points.length > 0 && (
        <section className="mb-6 p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3 flex items-center gap-2">
            <ListChecks className="h-3.5 w-3.5" /> Pontos chave
          </h2>
          <ul className="space-y-2">
            {call.key_points.map((k, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
                <span className="text-primary-500 mt-1">·</span>
                <span>{k}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Next actions */}
      {call.next_actions.length > 0 && (
        <section className="mb-6 p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3 flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5" /> Próximas acções sugeridas
          </h2>
          <ul className="space-y-2">
            {call.next_actions.map((a, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${URGENCY_CLS[a.urgency] || URGENCY_CLS.low}`}>
                  {a.urgency}
                </span>
                <span className="text-[10px] uppercase text-slate-400">{a.type}</span>
                <span className="text-slate-900 dark:text-white flex-1">{a.title}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Decisions */}
      {call.decisions.length > 0 && (
        <section className="mb-6 p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3">Decisões</h2>
          <ul className="space-y-2">
            {call.decisions.map((d, i) => (
              <li key={i} className="text-sm text-slate-700 dark:text-slate-200">· {d}</li>
            ))}
          </ul>
        </section>
      )}

      {/* Mentions */}
      {call.mentions.length > 0 && (
        <section className="mb-6 p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
          <h2 className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3 flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" /> Mencionados
          </h2>
          <div className="flex flex-wrap gap-2">
            {call.mentions.map((m, i) => (
              <span key={i} className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">{m}</span>
            ))}
          </div>
        </section>
      )}

      {/* Transcript */}
      {call.transcript && (
        <section className="mb-6 p-5 bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl">
          <button
            onClick={() => setShowTranscript((v) => !v)}
            className="w-full flex items-center justify-between text-xs uppercase tracking-wider font-semibold text-slate-500 mb-3"
          >
            <span className="flex items-center gap-2"><FileText className="h-3.5 w-3.5" /> Transcrição completa</span>
            <span className="text-slate-400">{showTranscript ? 'esconder' : 'mostrar'}</span>
          </button>
          {showTranscript && (
            <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200 font-sans leading-relaxed">{call.transcript}</pre>
          )}
        </section>
      )}

      {/* Meta */}
      <div className="text-xs text-slate-400 mt-8">
        {call.ai_model && <>Modelo: {call.ai_model} · </>}
        {call.ai_duration_ms && <>processado em {(call.ai_duration_ms / 1000).toFixed(1)}s · </>}
        criado em {new Date(call.created_at).toLocaleString('pt-PT')}
      </div>
    </div>
  );
};

export default CallDetailPage;
