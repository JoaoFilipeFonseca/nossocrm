'use client';

// TAREFAS Fase 2 — ligar a conta Google e espelhar as tarefas do CRM num
// calendário dedicado ("Foco Imo — Tarefas"). Um sentido: o CRM manda.
import React, { useCallback, useEffect, useState } from 'react';
import { Calendar, CheckCircle, AlertCircle, RefreshCw, Power, ExternalLink } from 'lucide-react';
import { SettingsSection } from './SettingsSection';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

interface GoogleStatus {
  connected: boolean;
  appConfigured?: boolean;
  status?: string;
  calendarReady?: boolean;
  lastError?: string | null;
  lastUsedAt?: string | null;
  pendentes?: number;
  espelhadas?: number;
}

const GOOGLE_FEEDBACK: Record<string, { msg: string; tone: 'success' | 'error' }> = {
  ligado: {
    msg: 'Conta Google ligada. As tarefas começam a aparecer no calendário "Foco Imo — Tarefas".',
    tone: 'success',
  },
  cancelado: { msg: 'Ligação cancelada.', tone: 'error' },
  estado_invalido: { msg: 'Sessão de ligação inválida ou expirada. Tente de novo.', tone: 'error' },
  sem_permissao: { msg: 'Apenas administradores podem ligar a conta Google.', tone: 'error' },
  sem_refresh: {
    msg: 'O Google não devolveu credencial de renovação. Retire o acesso à app na Conta Google e ligue de novo.',
    tone: 'error',
  },
  config: {
    msg: 'Faltam as credenciais da app Google no Vault (google_oauth_client_id / google_oauth_client_secret).',
    tone: 'error',
  },
  erro: { msg: 'Ocorreu um erro ao ligar a conta Google.', tone: 'error' },
};

export function GoogleCalendarSection() {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const canUse = profile?.role === 'admin';

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/google/status', { cache: 'no-store' });
      const data = (await res.json()) as GoogleStatus;
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canUse) loadStatus();
    else setLoading(false);
  }, [canUse, loadStatus]);

  // Feedback do retorno OAuth (?google=...), limpa o parâmetro depois.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const g = params.get('google');
    if (!g) return;
    const fb = GOOGLE_FEEDBACK[g];
    if (fb) {
      const detalhe = params.get('detalhe');
      addToast(detalhe ? `${fb.msg} (${detalhe})` : fb.msg, fb.tone);
    }
    params.delete('google');
    params.delete('detalhe');
    const url = new URL(window.location.href);
    url.search = params.toString();
    window.history.replaceState({}, '', url.toString());
  }, [addToast]);

  const disconnect = async () => {
    if (!confirm('Desligar o Google Calendar? As tarefas deixam de ser espelhadas.')) return;
    setBusy(true);
    try {
      const res = await fetch('/api/integrations/google/status', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect' }),
      });
      if (!res.ok) throw new Error();
      addToast('Google Calendar desligado.', 'success');
      await loadStatus();
    } catch {
      addToast('Não foi possível desligar.', 'error');
    } finally {
      setBusy(false);
    }
  };

  if (!canUse) {
    return (
      <SettingsSection title="Google Calendar" icon={Calendar}>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          Apenas administradores podem gerir esta ligação.
        </p>
      </SettingsSection>
    );
  }

  return (
    <SettingsSection title="Google Calendar" icon={Calendar}>
      <div className="mt-5 space-y-4">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          As tarefas do CRM passam a aparecer no teu Google Calendar, num calendário só delas —{' '}
          <b>Foco Imo — Tarefas</b>. Criar, editar, concluir, adiar ou apagar uma tarefa actualiza logo o
          evento. <b>O CRM é a fonte da verdade</b>: a ligação é num sentido só e o CRM{' '}
          <b>não vê o resto da tua agenda</b>.
        </p>

        {loading ? (
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <RefreshCw className="h-4 w-4 animate-spin" /> A verificar a ligação…
          </div>
        ) : status?.connected ? (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3">
              <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="text-sm text-emerald-800 dark:text-emerald-200">
                Ligado.{' '}
                {status.espelhadas === 0 && (status.pendentes ?? 0) > 0
                  ? 'A primeira sincronização está a decorrer.'
                  : `${status.espelhadas ?? 0} ${status.espelhadas === 1 ? 'tarefa espelhada' : 'tarefas espelhadas'}` +
                    ((status.pendentes ?? 0) > 0 ? ` · ${status.pendentes} por enviar` : ' · tudo em dia') +
                    '.'}
              </div>
            </div>

            {status.lastError && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  Último aviso: {status.lastError}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={loadStatus}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-white/15 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" /> Actualizar estado
              </button>
              <a
                href="https://calendar.google.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 dark:border-white/15 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
              >
                <ExternalLink className="h-4 w-4" /> Abrir o Google Calendar
              </a>
              <button
                type="button"
                onClick={disconnect}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-300 dark:border-rose-500/30 px-3 py-2 text-sm text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-500/10 disabled:opacity-50"
              >
                <Power className="h-4 w-4" /> Desligar
              </button>
            </div>
          </>
        ) : (
          <>
            {status?.appConfigured === false && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3">
                <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  Falta o passo no Google Cloud: criar o cliente OAuth e guardar{' '}
                  <code className="font-mono text-xs">google_oauth_client_id</code> e{' '}
                  <code className="font-mono text-xs">google_oauth_client_secret</code> no Vault do Supabase.
                  Assim que estiverem lá, o botão em baixo funciona.
                </div>
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- redirecciona para rota de API (OAuth), não é página Next; <Link> não se aplica */}
            <a
              href="/api/integrations/google/oauth/start"
              className="inline-flex items-center gap-2 rounded-lg bg-primary-600 hover:bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition-colors"
            >
              <Calendar className="h-4 w-4" /> Ligar a minha conta Google
            </a>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Como a app ainda não está verificada pela Google, vais ver um aviso &quot;Google hasn&apos;t
              verified this app&quot;. Carrega em <b>Advanced</b> e depois em <b>Go to Foco Imo CRM</b> — é a
              tua própria app, com a tua conta.
            </p>
          </>
        )}
      </div>
    </SettingsSection>
  );
}
