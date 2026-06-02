'use client';

import { useEffect } from 'react';
import { isIgnorableClientError } from '@/lib/client-errors/ignore';

/**
 * Sprint 18 c1 — listener global que captura erros front-end em produção.
 * - window.onerror: erros não tratados em handlers síncronos
 * - unhandledrejection: promises rejeitadas sem catch
 *
 * Faz POST a /api/client-errors com debounce simples (não envia mesma
 * mensagem duas vezes em < 5s) para evitar loop em erro recorrente.
 *
 * Silencioso para o utilizador — não mostra toast. O objectivo é dar
 * visibilidade ao admin sem assustar quem está a usar.
 */
export function ClientErrorReporter() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (process.env.NODE_ENV !== 'production') return;

    const recent = new Map<string, number>();
    const DEDUPE_MS = 5000;

    const send = (
      source: 'window.onerror' | 'unhandledrejection',
      message: string,
      stack: string | null,
    ) => {
      try {
        // Ruído interno benigno (ex.: corrida de streaming $RS do React 19,
        // ResizeObserver loop) — não é bug da app e não afecta o utilizador.
        // Ignora-se para não poluir /saúde nem disparar alertas Telegram.
        if (isIgnorableClientError(message, stack)) return;

        const key = `${source}:${message.slice(0, 200)}`;
        const now = Date.now();
        const last = recent.get(key) || 0;
        if (now - last < DEDUPE_MS) return;
        recent.set(key, now);
        if (recent.size > 100) {
          // poda básica: apaga entradas mais antigas que 60s
          const cutoff = now - 60000;
          for (const [k, t] of recent.entries()) {
            if (t < cutoff) recent.delete(k);
          }
        }

        const body = JSON.stringify({
          source,
          message: message.slice(0, 2000),
          stack: stack ? stack.slice(0, 10000) : null,
          url: window.location.href.slice(0, 2000),
          user_agent: navigator.userAgent.slice(0, 500),
          metadata: {
            viewport: `${window.innerWidth}x${window.innerHeight}`,
          },
        });

        // sendBeacon prefere-se para "fire-and-forget" e sobrevive a navegação
        if (navigator.sendBeacon) {
          const blob = new Blob([body], { type: 'application/json' });
          navigator.sendBeacon('/api/client-errors', blob);
        } else {
          fetch('/api/client-errors', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // nunca rebenta o app por causa do reporter
      }
    };

    const onError = (event: ErrorEvent) => {
      const message = event.message || 'unknown error';
      const stack = event.error?.stack || null;
      send('window.onerror', message, stack);
    };

    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        typeof reason === 'string'
          ? reason
          : reason?.message
            ? reason.message
            : JSON.stringify(reason).slice(0, 500);
      const stack = reason?.stack || null;
      send('unhandledrejection', message, stack);
    };

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  return null;
}
