'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Props {
  automationId: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
  initialName: string;
  initialIcon: string;
  initialDescription: string | null;
}

interface ExecResult {
  execution_id?: string;
  status?: string;
  duration_ms?: number;
  nodes_executed?: number;
  error?: string | null;
}

type ActionKey = 'activate' | 'deactivate' | 'execute' | 'save' | 'delete';

export default function BuilderActions({ automationId, status, initialName, initialIcon, initialDescription }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState<null | ActionKey>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackKind, setFeedbackKind] = useState<'ok' | 'err'>('ok');
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [icon, setIcon] = useState(initialIcon);
  const [description, setDescription] = useState(initialDescription ?? '');

  async function callJson(path: string, method: string, action: ActionKey, body?: unknown): Promise<unknown> {
    setPending(action);
    setFeedback(null);
    try {
      const res = await fetch(path, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.status === 204) return {};
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { message?: string }).message ?? `Erro ${res.status}`);
      return data;
    } finally {
      setPending(null);
    }
  }

  async function handleActivate() {
    try {
      await callJson(`/api/automations/${automationId}/activate`, 'POST', 'activate');
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
      await callJson(`/api/automations/${automationId}/deactivate`, 'POST', 'deactivate');
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
      const body = (await callJson(
        `/api/automations/${automationId}/execute`,
        'POST',
        'execute',
        { trigger_event: { type: 'manual.triggered', payload: { source: 'builder_button' } }, is_test: true },
      )) as ExecResult;
      setFeedbackKind(body.status === 'completed' || body.status === 'waiting' ? 'ok' : 'err');
      setFeedback(`${body.status} em ${body.duration_ms ?? '?'}ms, ${body.nodes_executed ?? '?'} nós${body.error ? ` (erro: ${body.error})` : ''}`);
      router.refresh();
    } catch (err) {
      setFeedbackKind('err');
      setFeedback(err instanceof Error ? err.message : 'Erro a executar');
    }
  }

  async function handleSaveMeta() {
    if (!name.trim()) {
      setFeedbackKind('err');
      setFeedback('Nome não pode ficar vazio.');
      return;
    }
    try {
      await callJson(`/api/automations/${automationId}`, 'PATCH', 'save', {
        name: name.trim(),
        icon: icon.trim() || '⚡',
        description: description.trim() || null,
      });
      setFeedbackKind('ok');
      setFeedback('Detalhes guardados.');
      setEditing(false);
      router.refresh();
    } catch (err) {
      setFeedbackKind('err');
      setFeedback(err instanceof Error ? err.message : 'Erro a guardar');
    }
  }

  async function handleDelete() {
    const ok = window.confirm(
      `Apagar a automação "${initialName}"?\n\nIsto remove definitivamente o fluxo, todos os triggers e o histórico de execuções. Não pode ser desfeito.`,
    );
    if (!ok) return;
    try {
      await callJson(`/api/automations/${automationId}`, 'DELETE', 'delete');
      router.push('/automacoes');
      router.refresh();
    } catch (err) {
      setFeedbackKind('err');
      setFeedback(err instanceof Error ? err.message : 'Erro a apagar');
    }
  }

  const canActivate = status === 'draft' || status === 'paused';
  const canDeactivate = status === 'active';
  const busy = pending !== null;

  return (
    <div className="flex flex-col items-end gap-2 min-w-0">
      <div className="flex flex-wrap items-center gap-2 justify-end">
        <button
          type="button"
          onClick={() => setEditing((v) => !v)}
          disabled={busy}
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          ✎ {editing ? 'Cancelar' : 'Editar detalhes'}
        </button>
        <button
          type="button"
          onClick={handleExecute}
          disabled={busy}
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {pending === 'execute' ? 'A executar...' : '▶︎ Executar agora'}
        </button>
        {canActivate ? (
          <button
            type="button"
            onClick={handleActivate}
            disabled={busy}
            className="inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {pending === 'activate' ? 'A activar...' : 'Activar'}
          </button>
        ) : null}
        {canDeactivate ? (
          <button
            type="button"
            onClick={handleDeactivate}
            disabled={busy}
            className="inline-flex items-center rounded-md bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {pending === 'deactivate' ? 'A pausar...' : 'Pausar'}
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="inline-flex items-center rounded-md border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          {pending === 'delete' ? 'A apagar...' : '🗑 Eliminar'}
        </button>
      </div>

      {editing ? (
        <div className="w-full max-w-md rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
          <label className="block text-xs">
            <span className="text-slate-600">Nome</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <label className="block text-xs">
            <span className="text-slate-600">Ícone (emoji)</span>
            <input
              type="text"
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              maxLength={4}
              className="mt-1 w-20 rounded border border-slate-300 px-2 py-1 text-sm text-center"
            />
          </label>
          <label className="block text-xs">
            <span className="text-slate-600">Descrição</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
            />
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setEditing(false); setName(initialName); setIcon(initialIcon); setDescription(initialDescription ?? ''); }}
              className="text-xs text-slate-600 hover:text-slate-900"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSaveMeta}
              disabled={busy}
              className="rounded bg-violet-600 px-3 py-1 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {pending === 'save' ? 'A guardar...' : 'Guardar'}
            </button>
          </div>
        </div>
      ) : null}

      {feedback ? (
        <p className={`text-xs ${feedbackKind === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>{feedback}</p>
      ) : null}
    </div>
  );
}
