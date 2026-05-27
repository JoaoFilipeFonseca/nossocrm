'use client';

import React, { useEffect, useState } from 'react';
import { Database, Clock, AlertOctagon, Sparkles, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

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

const HealthPage: React.FC = () => {
  const [data, setData] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <div className={`rounded-2xl border p-5 ${errorsAlert ? 'bg-rose-50 dark:bg-rose-500/5 border-rose-200 dark:border-rose-500/30' : 'bg-white dark:bg-white/5 border-slate-200 dark:border-white/10'}`}>
          <div className="flex items-center gap-2 mb-3">
            <AlertOctagon className={`h-5 w-5 ${errorsAlert ? 'text-rose-600 dark:text-rose-400' : 'text-slate-500'}`} />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Erros front-end (24h)</h3>
            {!errorsAlert && data.client_errors_24h === 0 && <CheckCircle2 className="h-4 w-4 text-emerald-500 ml-auto" />}
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">{data.client_errors_24h}</div>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {data.client_errors_24h === 0
              ? 'Nada partiu nas últimas 24h.'
              : errorsAlert
                ? 'Alerta. Mais de 5 erros — investigar.'
                : 'Dentro do normal.'}
          </div>
        </div>

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
