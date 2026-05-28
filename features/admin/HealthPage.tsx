'use client';

import React, { useEffect, useState } from 'react';
import { Database, Clock, AlertOctagon, Sparkles, CheckCircle2, XCircle, RefreshCw, ChevronDown, ChevronUp, Check } from 'lucide-react';

type HealthStatus = {
  generated_at: string;
  organization_id: string;
  last_backup: { name: string; created_at: string; size_bytes: number } | null;
  cron_jobs: Array<{ jobid: number; jobname: string; schedule: string; active: boolean }>;
  client_errors_24h: number;
  ai: { gemini_configured: boolean; anthropic_configured: boolean; ai_enabled: boolean } | null;
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

type ClientErrorRow = {
  id: string;
  source: string;
  message: string;
  stack: string | null;
  url: string | null;
  created_at: string;
  resolved: boolean;
  alerted_at: string | null;
};

const HealthPage: React.FC = () => {
  const [data, setData] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [errors, setErrors] = useState<ClientErrorRow[]>([]);
  const [errorsLoading, setErrorsLoading] = useState(false);

  const loadErrors = () => {
    setErrorsLoading(true);
    fetch('/api/admin/client-errors', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => setErrors(Array.isArray(j.items) ? j.items : []))
      .catch(() => setErrors([]))
      .finally(() => setErrorsLoading(false));
  };

  const toggleErrors = () => {
    setShowErrors((v) => {
      const next = !v;
      if (next && errors.length === 0) loadErrors();
      return next;
    });
  };

  const resolveError = (id: string) => {
    setErrors((rows) => rows.map((r) => r.id === id ? { ...r, resolved: true } : r));
    fetch(`/api/admin/client-errors?id=${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ resolved: true }),
    }).catch(() => {});
  };

  const load = () => {
    setLoading(true);
    setError(null);
    fetch('/api/admin/health', { cache: 'no-store' })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (!ok) {
          setError(j.error || 'Erro a carregar.');
          setData(null);
          return;
        }
        setData(j.health);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading && !data) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-sm text-slate-500">A carregar...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-4 text-sm">{error}</div>
      </div>
    );
  }

  if (!data) return null;

  const backupOk = data.last_backup && (Date.now() - new Date(data.last_backup.created_at).getTime()) < 8 * 86400000;
  const errorsAlert = data.client_errors_24h > 5;

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-display">Saúde do CRM</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Estado operacional. Gerado {new Date(data.generated_at).toLocaleString('pt-PT')}.
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:hover:text-white px-3 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-white/5"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Recarregar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Último backup */}
        <div className={`rounded-2xl border p-5 ${backupOk ? 'bg-emerald-50 dark:bg-emerald-500/5 border-emerald-200 dark:border-emerald-500/30' : 'bg-rose-50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/30'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Database className={`h-5 w-5 ${backupOk ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`} />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Último backup</h3>
            {backupOk ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />
            ) : (
              <XCircle className="h-4 w-4 text-rose-500 ml-auto" />
            )}
          </div>
          {data.last_backup ? (
            <>
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                há {timeAgo(data.last_backup.created_at)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">
                {data.last_backup.name.split('/').pop()} · {formatBytes(data.last_backup.size_bytes || 0)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {new Date(data.last_backup.created_at).toLocaleString('pt-PT')}
              </div>
            </>
          ) : (
            <div className="text-sm text-rose-700 dark:text-rose-300">
              Nenhum backup encontrado. O cron corre Domingos 3h UTC.
            </div>
          )}
        </div>

        {/* Erros front-end 24h */}
        <button
          type="button"
          onClick={toggleErrors}
          className={`text-left rounded-2xl border p-5 transition-colors ${errorsAlert ? 'bg-rose-50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/30 hover:bg-rose-100 dark:hover:bg-rose-500/10' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20'}`}
        >
          <div className="flex items-center gap-2 mb-3">
            <AlertOctagon className={`h-5 w-5 ${errorsAlert ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`} />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Erros front-end (24h)</h3>
            <span className="ml-auto flex items-center gap-1">
              {!errorsAlert && data.client_errors_24h === 0 && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
              {showErrors ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </span>
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{data.client_errors_24h}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {data.client_errors_24h === 0
              ? 'Nada partiu nas últimas 24h.'
              : errorsAlert
                ? 'Alerta. Mais de 5 erros — clica para investigar.'
                : 'Dentro do normal. Clica para ver detalhe.'}
          </div>
        </button>

        {/* AI keys */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-5 w-5 text-primary-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">IA</h3>
          </div>
          <ul className="space-y-1.5 text-sm">
            <li className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300">Gemini (Google)</span>
              {data.ai?.gemini_configured ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-500" />
              )}
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300">Anthropic (Claude)</span>
              {data.ai?.anthropic_configured ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-500" />
              )}
            </li>
            <li className="flex items-center justify-between">
              <span className="text-slate-600 dark:text-slate-300">IA activada</span>
              {data.ai?.ai_enabled ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              ) : (
                <XCircle className="h-4 w-4 text-rose-500" />
              )}
            </li>
          </ul>
        </div>

        {/* Sprint 26 c1: lista expandida de erros */}
        {showErrors && (
          <div className="md:col-span-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-rose-500" />
                Erros recentes (top 30)
              </h3>
              <button onClick={loadErrors} className="text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white inline-flex items-center gap-1">
                <RefreshCw className="h-3 w-3" /> Recarregar
              </button>
            </div>
            {errorsLoading ? (
              <p className="text-sm text-slate-400">A carregar...</p>
            ) : errors.length === 0 ? (
              <p className="text-sm text-slate-500">Sem erros registados.</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {errors.map((e) => (
                  <li
                    key={e.id}
                    className={`p-2 rounded-lg border ${e.resolved ? 'border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-white/5 opacity-60' : 'border-rose-100 dark:border-rose-500/20 bg-rose-50/50 dark:bg-rose-500/5'}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <code className="text-[10px] text-slate-500 dark:text-slate-400">{e.source}</code>
                          <span className="text-[10px] text-slate-400">{new Date(e.created_at).toLocaleString('pt-PT')}</span>
                          {e.alerted_at && <span className="text-[10px] text-amber-600 dark:text-amber-400">📨 alerta enviado</span>}
                        </div>
                        <div className="text-slate-800 dark:text-slate-200 font-medium mt-1 break-words">{e.message}</div>
                        {e.url && <div className="text-[10px] text-slate-400 mt-0.5 truncate" title={e.url}>{e.url}</div>}
                        {e.stack && (
                          <details className="mt-1">
                            <summary className="text-[10px] text-slate-400 cursor-pointer hover:text-slate-600">ver stack</summary>
                            <pre className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 overflow-x-auto whitespace-pre-wrap break-words">{e.stack.slice(0, 1500)}</pre>
                          </details>
                        )}
                      </div>
                      {!e.resolved && (
                        <button
                          onClick={() => resolveError(e.id)}
                          className="flex-shrink-0 text-[10px] text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1 px-2 py-1 rounded border border-emerald-300 dark:border-emerald-500/30 hover:bg-emerald-50 dark:hover:bg-emerald-500/10"
                        >
                          <Check className="h-3 w-3" /> Marcar resolvido
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Cron jobs */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 p-5 md:col-span-2">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="h-5 w-5 text-primary-500" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Cron jobs activos ({data.cron_jobs.length})</h3>
          </div>
          {data.cron_jobs.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum cron job activo.</p>
          ) : (
            <ul className="text-sm space-y-1">
              {data.cron_jobs.map((job) => (
                <li key={job.jobid} className="flex items-center justify-between py-1 border-b border-slate-100 dark:border-white/5 last:border-0">
                  <span className="text-slate-700 dark:text-slate-200 font-medium">{job.jobname}</span>
                  <code className="text-xs text-slate-500 dark:text-slate-400">{job.schedule}</code>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default HealthPage;
