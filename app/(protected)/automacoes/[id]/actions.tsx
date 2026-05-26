'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  automationId: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
}

interface ExecResult {
  execution_id?: string;
  status?: string;
  duration_ms?: number;
  nodes_executed?: number;
  error?: string | null;
}

export default function BuilderActions({ automationId, status }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<null | 'activate' | 'deactivate' | 'execute'>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackKind, setFeedbackKind] = useState<'ok' | 'err'>('ok');

  async function call(path: string, opts: RequestInit = {}, action: 'activate' | 'deactivate' | 'execute'): Promise<unknown> {
    setPending(action);
    setFeedback(null);
    try {
      const res = await fetch(path, { method: 'POST', ...opts });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((body as { message?: string }).message ?? `Erro ${res.status}`);
      return body;
    } finally {
      setPending(null);
    }
  }

  async function handleActivate() {
    try {
      await call(`/api/automations/${automationId}/activate`, {}, 'activate');
      setFeedbackKind('ok');
      setFeedback('Automação activada. Vai disparar nos próximos eventos.');
      router.refresh();
    } catch (err) {
      setFeedbackKind('err');
      setFeedback(err instanceof Error ? err.message : 'Erro a activar');
    }
  }

  async function handleDeactivate() {
    try {
      await call(`/api/automations/${automationId}/deactivate`, {}, 'deactivate');
      setFeedbackKind('ok');
      setFeedback('Automação pausada.');
      router.refresh();
    } catch (err) {
      setFeedbackKind('err');
      setFeedback(err instanceof Error ? err.message : 'Erro a pausar');
    }
  }

  async function handleExecute() {
    try {
      const body = (await call(
        `/api/automations/${automationId}/execute`,
        {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ trigger_event: { type: 'manual.triggered', payload: { source: 'builder_button' } }, is_test: true }),
        },
        'execute',
      )) as ExecResult;
      setFeedbackKind(body.status === 'completed' || body.status === 'waiting' ? 'ok' : 'err');
      setFeedback(`${body.status} em ${body.duration_ms ?? '?'}ms, ${body.nodes_executed ?? '?'} nós${body.error ? ` (erro: ${body.error})` : ''}`);
      router.refresh();
    } catch (err) {
      setFeedbackKind('err');
      setFeedback(err instanceof Error ? err.message : 'Erro a executar');
    }
  }

  const canActivate = status === 'draft' || status === 'paused';
  const canDeactivate = status === 'active';

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleExecute}
          disabled={pending !== null}
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {pending === 'execute' ? 'A executar...' : '▶︎ Executar agora'}
        </button>
        {canActivate ? (
          <button
            type="button"
            onClick={handleActivate}
            disabled={pending !== null}
            className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending === 'activate' ? 'A activar...' : 'Activar'}
          </button>
        ) : null}
        {canDeactivate ? (
          <button
            type="button"
            onClick={handleDeactivate}
            disabled={pending !== null}
            className="inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {pending === 'deactivate' ? 'A pausar...' : 'Pausar'}
          </button>
        ) : null}
      </div>
      {feedback ? (
        <p className={`text-xs ${feedbackKind === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>{feedback}</p>
      ) : null}
    </div>
  );
}
