'use client';

/**
 * /unsubscribe — página pública de anular subscrição de emails (RGPD).
 *
 * Chega-se aqui pelo link no rodapé dos emails de automação:
 *   /unsubscribe?o=<orgId>&e=<email>&t=<token HMAC>
 * A anulação só acontece ao clicar no botão (POST) — um GET nunca altera nada,
 * para que scanners de email que seguem links não anulem subscrições sozinhos.
 */
import React, { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { MailX, CheckCircle2, AlertTriangle } from 'lucide-react';

type Status = 'idle' | 'working' | 'done' | 'error';

function UnsubscribeInner() {
  const params = useSearchParams();
  const o = params.get('o') ?? '';
  const e = params.get('e') ?? '';
  const t = params.get('t') ?? '';
  const linkValido = Boolean(o && e && t);

  const [status, setStatus] = useState<Status>('idle');

  const confirmar = async () => {
    setStatus('working');
    try {
      const res = await fetch('/api/email/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ o, e, t }),
      });
      const json = await res.json().catch(() => ({ ok: false }));
      setStatus(json.ok ? 'done' : 'error');
    } catch {
      setStatus('error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 px-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 shadow-sm text-center">
        {!linkValido ? (
          <>
            <AlertTriangle className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Ligação incompleta</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Esta ligação de anular subscrição não é válida. Use o link que recebeu no email.
            </p>
          </>
        ) : status === 'done' ? (
          <>
            <CheckCircle2 className="mx-auto h-10 w-10 text-green-500" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Subscrição anulada</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              O endereço <span className="font-medium text-slate-900 dark:text-white">{e}</span> não volta a
              receber emails nossos. Se mudar de ideias, basta responder a qualquer email antigo.
            </p>
          </>
        ) : (
          <>
            <MailX className="mx-auto h-10 w-10 text-slate-400" aria-hidden="true" />
            <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Anular subscrição</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Deixar de receber emails em{' '}
              <span className="font-medium text-slate-900 dark:text-white">{e}</span>?
            </p>
            <button
              type="button"
              onClick={confirmar}
              disabled={status === 'working'}
              className="mt-6 w-full rounded-xl bg-slate-900 dark:bg-white px-4 py-2.5 text-sm font-semibold text-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50 transition"
            >
              {status === 'working' ? 'A anular…' : 'Sim, anular subscrição'}
            </button>
            {status === 'error' && (
              <p className="mt-3 text-sm text-red-500" role="alert">
                Não foi possível anular. Tente novamente a partir do link do email.
              </p>
            )}
          </>
        )}
        <p className="mt-6 text-xs text-slate-400 dark:text-slate-500">
          <a href="https://joaofilipefonseca.pt/privacidade" className="underline hover:text-slate-600 dark:hover:text-slate-300">
            Política de privacidade
          </a>
        </p>
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeInner />
    </Suspense>
  );
}
