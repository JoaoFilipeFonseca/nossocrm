'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Facebook,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Copy,
  ExternalLink,
  Power,
  LayoutGrid,
} from 'lucide-react';
import { SettingsSection } from './SettingsSection';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { cn } from '@/lib/utils/cn';

interface MetaStatus {
  connected: boolean;
  status?: string;
  accountName?: string;
  pages?: { id: string; name: string }[];
  adAccounts?: { id: string; name: string; account_id: string }[];
  subscribedPageId?: string | null;
  lastError?: string | null;
  updatedAt?: string;
}

// Mensagens de retorno do fluxo OAuth (?meta=...).
const META_FEEDBACK: Record<string, { msg: string; tone: 'success' | 'error' }> = {
  ligado: { msg: 'Conta Meta ligada com sucesso. As leads vão entrar automaticamente.', tone: 'success' },
  sem_pagina: { msg: 'Conta ligada, mas nenhuma Página foi subscrita. Verifique as permissões das Páginas.', tone: 'error' },
  cancelado: { msg: 'Ligação cancelada.', tone: 'error' },
  estado_invalido: { msg: 'Sessão de ligação inválida ou expirada. Tente novamente.', tone: 'error' },
  sem_permissao: { msg: 'Apenas administradores podem ligar a conta Meta.', tone: 'error' },
  config: { msg: 'Credenciais da app Meta em falta. Contacte o suporte.', tone: 'error' },
  erro: { msg: 'Ocorreu um erro ao ligar a conta Meta.', tone: 'error' },
};

export function MetaAdsSection() {
  const { profile } = useAuth();
  const { addToast } = useToast();
  const [status, setStatus] = useState<MetaStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [redirectUri, setRedirectUri] = useState('');

  const canUse = profile?.role === 'admin';

  const loadStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/integrations/meta/status', { cache: 'no-store' });
      const data = (await res.json()) as MetaStatus;
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setRedirectUri(`${window.location.origin}/api/integrations/meta/oauth/callback`);
    }
  }, []);

  useEffect(() => {
    if (canUse) loadStatus();
    else setLoading(false);
  }, [canUse, loadStatus]);

  // Feedback do retorno OAuth (?meta=...), limpa o parâmetro depois.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const meta = params.get('meta');
    if (!meta) return;
    const fb = META_FEEDBACK[meta];
    if (fb) {
      const detalhe = params.get('detalhe');
      addToast(detalhe ? `${fb.msg} (${detalhe})` : fb.msg, fb.tone);
    }
    params.delete('meta');
    params.delete('detalhe');
    const url = new URL(window.location.href);
    url.search = params.toString();
    window.history.replaceState({}, '', url.toString());
  }, [addToast]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      addToast(`${label} copiado.`, 'success');
    } catch {
      addToast('Não foi possível copiar.', 'error');
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      const res = await fetch('/api/integrations/meta/disconnect', { method: 'POST' });
      if (!res.ok) throw new Error();
      addToast('Conta Meta desligada.', 'success');
      await loadStatus();
    } catch {
      addToast('Erro ao desligar a conta Meta.', 'error');
    } finally {
      setDisconnecting(false);
    }
  };

  if (!canUse) {
    return (
      <SettingsSection title="Meta Ads (Facebook & Instagram)" icon={Facebook}>
        <div className="p-4 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-sm text-slate-600 dark:text-slate-300">
          Disponível apenas para administradores.
        </div>
      </SettingsSection>
    );
  }

  const isConnected = status?.connected;
  const isError = status?.status === 'error';

  return (
    <SettingsSection title="Meta Ads (Facebook & Instagram)" icon={Facebook}>
      <p className="text-sm text-slate-600 dark:text-slate-300 mb-5 leading-relaxed">
        Ligue a sua conta de Facebook para receber automaticamente as leads dos
        seus anúncios, com a atribuição do anúncio que as gerou.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
        </div>
      ) : isConnected ? (
        <div className="space-y-4">
          {/* Estado ligado */}
          <div className="flex items-start justify-between gap-4 p-4 rounded-xl bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-semibold text-green-800 dark:text-green-200">
                  Conta ligada{status?.accountName ? `: ${status.accountName}` : ''}
                </h4>
                <p className="text-xs text-green-700 dark:text-green-300 mt-0.5">
                  As leads dos anúncios entram automaticamente no CRM.
                </p>
              </div>
            </div>
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                bg-white dark:bg-white/5 border border-red-200 dark:border-red-500/20
                text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10
                transition-colors disabled:opacity-50 shrink-0"
            >
              <Power className="w-3.5 h-3.5" />
              Desligar
            </button>
          </div>

          {/* Páginas */}
          {status?.pages && status.pages.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Páginas
              </p>
              <div className="space-y-1.5">
                {status.pages.map((p) => (
                  <div key={p.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                    <LayoutGrid className="w-3.5 h-3.5 text-slate-400" />
                    <span>{p.name}</span>
                    {status.subscribedPageId === p.id && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-300">
                        a receber leads
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contas de anúncios */}
          {status?.adAccounts && status.adAccounts.length > 0 && (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10">
              <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                Contas de anúncios
              </p>
              <div className="space-y-1">
                {status.adAccounts.map((a) => (
                  <p key={a.id} className="text-sm text-slate-700 dark:text-slate-200">
                    {a.name} <span className="text-slate-400">({a.account_id})</span>
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {isError && status?.lastError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20">
              <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700 dark:text-red-300">{status.lastError}</p>
            </div>
          )}

          <a
            href="/api/integrations/meta/oauth/start"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold
              bg-[#1877F2] text-white hover:bg-[#1568d8] transition-colors"
          >
            <Facebook className="w-4 h-4" />
            Ligar Facebook
          </a>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Vai ser encaminhado para o Facebook para autorizar o acesso às suas
            Páginas e leads. Só os administradores podem ligar a conta.
          </p>
        </div>
      )}

      {/* URL de redireccionamento a configurar na app Meta */}
      <div className="mt-6 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-3">
        <p className="text-[11px] font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wider mb-1.5">
          URL de redireccionamento (colar na app Meta)
        </p>
        <p className="text-[11px] text-blue-700 dark:text-blue-300 mb-2">
          Em developers.facebook.com → app → Início de sessão do Facebook →
          Definições → "Valid OAuth Redirect URIs", cole esta URL:
        </p>
        <div className="flex items-center gap-1">
          <code className="flex-1 text-[11px] bg-white dark:bg-black/30 border border-blue-200 dark:border-blue-500/20 px-2.5 py-2 rounded-lg text-blue-900 dark:text-blue-100 break-all select-all font-mono">
            {redirectUri || '...'}
          </code>
          <button
            onClick={() => copy(redirectUri, 'URL')}
            className="shrink-0 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            title="Copiar URL"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
        </div>
        <a
          href="https://developers.facebook.com/apps/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline mt-2"
        >
          Abrir Meta for Developers <ExternalLink size={11} />
        </a>
      </div>
    </SettingsSection>
  );
}
