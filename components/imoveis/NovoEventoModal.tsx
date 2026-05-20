'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const KINDS = [
  { value: 'visita', label: 'Visita' },
  { value: 'oferta', label: 'Oferta' },
  { value: 'proposta', label: 'Proposta' },
  { value: 'contraproposta', label: 'Contraproposta' },
  { value: 'cpcv', label: 'CPCV' },
  { value: 'escritura', label: 'Escritura' },
  { value: 'mudanca_preco', label: 'Mudança de preço' },
  { value: 'fotos_atualizadas', label: 'Fotos actualizadas' },
  { value: 'retirado', label: 'Retirado' },
  { value: 'reactivado', label: 'Reactivado' },
  { value: 'avaliacao', label: 'Avaliação' },
  { value: 'nota', label: 'Nota' },
];

const KINDS_COM_VALOR = new Set(['oferta', 'proposta', 'contraproposta', 'mudanca_preco', 'avaliacao']);

interface Props {
  imovelId: string;
  open: boolean;
  onClose: () => void;
}

export default function NovoEventoModal({ imovelId, open, onClose }: Props) {
  const router = useRouter();
  const [kind, setKind] = useState('visita');
  const [valor, setValor] = useState('');
  const [descricao, setDescricao] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => {
    const now = new Date();
    now.setSeconds(0, 0);
    return now.toISOString().slice(0, 16);
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        kind,
        valor: valor ? Number(valor) : null,
        descricao: descricao.trim() || null,
        occurred_at: new Date(occurredAt).toISOString(),
      };
      const res = await fetch(`/api/imoveis/${imovelId}/eventos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Erro a criar evento');
      onClose();
      setKind('visita'); setValor(''); setDescricao('');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Novo evento</h2>

        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-600">Tipo</span>
            <select value={kind} onChange={(e) => setKind(e.target.value)} className={inputCls}>
              {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-600">Quando</span>
            <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className={inputCls} />
          </label>

          {KINDS_COM_VALOR.has(kind) && (
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-slate-600">Valor (€)</span>
              <input type="number" step="100" value={valor} onChange={(e) => setValor(e.target.value)} className={inputCls} />
            </label>
          )}

          <label className="block">
            <span className="text-xs font-medium uppercase tracking-wide text-slate-600">Descrição</span>
            <textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} className={inputCls} />
          </label>

          {error && <div className="rounded-md bg-red-50 text-red-700 p-3 text-sm">{error}</div>}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} disabled={submitting}
              className="rounded-md px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
              Cancelar
            </button>
            <button type="submit" disabled={submitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {submitting ? 'A gravar...' : 'Registar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputCls = 'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
