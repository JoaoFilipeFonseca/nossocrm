'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ImovelMandato } from '@/lib/imoveis/shared';

const TIPOS = [
  { v: 'simples', l: 'Simples' },
  { v: 'exclusivo', l: 'Exclusivo' },
  { v: 'misto', l: 'Misto' },
];
const PAGADORES = [
  { v: 'vendedor', l: 'Vendedor' },
  { v: 'comprador', l: 'Comprador' },
  { v: 'ambos', l: 'Ambos' },
];

interface Props {
  imovelId: string;
  mandatos: ImovelMandato[];
}

export default function ImovelMandatos({ imovelId, mandatos }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [form, setForm] = useState({
    tipo: 'simples',
    data_inicio: new Date().toISOString().slice(0, 10),
    data_fim: '',
    comissao_pct: '',
    comissao_paga_por: 'vendedor',
    notas: '',
  });

  async function addMand(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/imoveis/${imovelId}/mandatos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Erro');
      setForm({ ...form, data_fim: '', comissao_pct: '', notas: '' });
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setAdding(false);
    }
  }

  async function setActivo(mandId: string, activo: boolean) {
    await fetch(`/api/imoveis/${imovelId}/mandatos/${mandId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo }),
    });
    startTransition(() => router.refresh());
  }

  async function removeMand(mandId: string) {
    if (!confirm('Apagar mandato?')) return;
    await fetch(`/api/imoveis/${imovelId}/mandatos/${mandId}`, { method: 'DELETE' });
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      {mandatos.length === 0 ? (
        <p className="text-sm text-slate-500">Sem mandatos registados.</p>
      ) : (
        <ul className="space-y-2">
          {mandatos.map((m) => (
            <li key={m.id} className="rounded-md border border-slate-200 p-3">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium capitalize">{m.tipo}</span>
                    {m.activo && <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-medium">Activo</span>}
                  </div>
                  <p className="text-sm text-slate-700 mt-1">
                    {new Date(m.data_inicio).toLocaleDateString('pt-PT')}
                    {m.data_fim && ` → ${new Date(m.data_fim).toLocaleDateString('pt-PT')}`}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {m.comissao_pct != null && `${m.comissao_pct}%`}
                    {m.comissao_paga_por && ` · pago por ${m.comissao_paga_por}`}
                  </p>
                  {m.notas && <p className="text-sm text-slate-600 mt-1">{m.notas}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {!m.activo && (
                    <button type="button" onClick={() => setActivo(m.id, true)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50">Tornar activo</button>
                  )}
                  <button type="button" onClick={() => removeMand(m.id)} className="text-red-600 hover:text-red-700 text-xs">Remover</button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addMand} className="rounded-md border border-slate-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold">Adicionar mandato</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Tipo">
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={inputCls}>
              {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </Field>
          <Field label="Início">
            <input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Fim (opcional)">
            <input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Comissão (%)">
            <input type="number" step="0.1" value={form.comissao_pct} onChange={(e) => setForm({ ...form, comissao_pct: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Paga por">
            <select value={form.comissao_paga_por} onChange={(e) => setForm({ ...form, comissao_paga_por: e.target.value })} className={inputCls}>
              {PAGADORES.map((p) => <option key={p.v} value={p.v}>{p.l}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notas">
          <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={2} className={inputCls} />
        </Field>
        {error && <div className="rounded-md bg-red-50 text-red-700 p-2 text-xs">{error}</div>}
        <button type="submit" disabled={adding}
          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {adding ? 'A criar…' : '+ Mandato'}
        </button>
      </form>
    </div>
  );
}

const inputCls = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wide text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}
