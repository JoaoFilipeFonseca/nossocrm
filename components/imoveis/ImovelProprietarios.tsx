'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { ImovelProprietario, ProprietarioDocumento, ProprietarioDocKind } from '@/lib/imoveis/shared';
import { proprietarioDocLabel } from '@/lib/imoveis/shared';

const DOC_KINDS: Array<{ v: ProprietarioDocKind; l: string }> = [
  { v: 'cc', l: 'Cartão de Cidadão' },
  { v: 'nif', l: 'NIF' },
  { v: 'comprovativo_morada', l: 'Comprovativo morada' },
  { v: 'certidao_casamento', l: 'Certidão casamento' },
  { v: 'sentenca_divorcio', l: 'Sentença divórcio' },
  { v: 'habilitacao_herdeiros', l: 'Habilitação herdeiros' },
  { v: 'procuracao', l: 'Procuração' },
  { v: 'declaracao_nao_residencia', l: 'Declaração não-residência' },
  { v: 'outro', l: 'Outro' },
];

const REGIMES = [
  { v: 'comunhao_geral', l: 'Comunhão geral' },
  { v: 'comunhao_adquiridos', l: 'Comunhão de adquiridos' },
  { v: 'separacao', l: 'Separação de bens' },
  { v: 'solteiro', l: 'Solteiro(a)' },
];

interface Props {
  imovelId: string;
  proprietarios: ImovelProprietario[];
  docsByProp: Record<string, ProprietarioDocumento[]>;
}

export default function ImovelProprietarios({ imovelId, proprietarios, docsByProp }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [form, setForm] = useState({
    nome: '', percentagem: '', regime_bens: '', e_residente: true, notas: '',
  });

  async function addProp(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/imoveis/${imovelId}/proprietarios`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Erro');
      setForm({ nome: '', percentagem: '', regime_bens: '', e_residente: true, notas: '' });
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setAdding(false);
    }
  }

  async function removeProp(propId: string) {
    if (!confirm('Apagar proprietário e todos os seus documentos?')) return;
    await fetch(`/api/imoveis/${imovelId}/proprietarios/${propId}`, { method: 'DELETE' });
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      {proprietarios.length === 0 ? (
        <p className="text-sm text-slate-500">Sem proprietários registados.</p>
      ) : (
        <ul className="space-y-3">
          {proprietarios.map((p) => (
            <PropCard
              key={p.id}
              imovelId={imovelId}
              prop={p}
              docs={docsByProp[p.id] ?? []}
              onRemove={() => removeProp(p.id)}
            />
          ))}
        </ul>
      )}

      <form onSubmit={addProp} className="rounded-md border border-slate-200 p-4 space-y-3">
        <h3 className="text-sm font-semibold">Adicionar proprietário</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Nome">
            <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputCls} />
          </Field>
          <Field label="% de propriedade">
            <input type="number" step="0.01" value={form.percentagem} onChange={(e) => setForm({ ...form, percentagem: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Regime de bens">
            <select value={form.regime_bens} onChange={(e) => setForm({ ...form, regime_bens: e.target.value })} className={inputCls}>
              <option value="">—</option>
              {REGIMES.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}
            </select>
          </Field>
          <Field label="Residente fiscal em PT">
            <label className="flex items-center gap-2 text-sm mt-2">
              <input type="checkbox" checked={form.e_residente} onChange={(e) => setForm({ ...form, e_residente: e.target.checked })} />
              <span>Sim</span>
            </label>
          </Field>
        </div>
        <Field label="Notas">
          <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={2} className={inputCls} />
        </Field>
        {error && <div className="rounded-md bg-red-50 text-red-700 p-2 text-xs">{error}</div>}
        <button type="submit" disabled={adding || !form.nome.trim()}
          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {adding ? 'A adicionar…' : '+ Proprietário'}
        </button>
      </form>
    </div>
  );
}

function PropCard({ imovelId, prop, docs, onRemove }: { imovelId: string; prop: ImovelProprietario; docs: ProprietarioDocumento[]; onRemove: () => void }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [docKind, setDocKind] = useState<ProprietarioDocKind>('cc');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', docKind);
      const res = await fetch(`/api/imoveis/${imovelId}/proprietarios/${prop.id}/documentos`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Erro upload');
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function abrir(docId: string) {
    const res = await fetch(`/api/imoveis/${imovelId}/proprietarios/${prop.id}/documentos/${docId}`);
    const json = await res.json();
    if (json.url) window.open(json.url, '_blank', 'noopener,noreferrer');
  }

  async function deletarDoc(docId: string) {
    if (!confirm('Apagar documento?')) return;
    await fetch(`/api/imoveis/${imovelId}/proprietarios/${prop.id}/documentos/${docId}`, { method: 'DELETE' });
    startTransition(() => router.refresh());
  }

  return (
    <li className="rounded-md border border-slate-200 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-slate-900">{prop.nome ?? '—'}</p>
          <p className="text-xs text-slate-500 mt-0.5">
            {prop.percentagem != null && `${prop.percentagem}% propriedade`}
            {prop.regime_bens && ` · ${prop.regime_bens.replace(/_/g, ' ')}`}
            {!prop.e_residente && ' · não-residente'}
          </p>
          {prop.notas && <p className="text-sm text-slate-600 mt-1">{prop.notas}</p>}
        </div>
        <button type="button" onClick={onRemove} className="text-red-600 hover:text-red-700 text-xs">Remover</button>
      </div>

      <div className="mt-3 pt-3 border-t border-slate-100">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">Documentos</p>
        {docs.length === 0 ? (
          <p className="text-xs text-slate-500 mb-2">Sem documentos.</p>
        ) : (
          <ul className="space-y-1 mb-2">
            {docs.map((d) => (
              <li key={d.id} className="flex items-center justify-between text-sm">
                <button type="button" onClick={() => abrir(d.id)} className="text-blue-600 hover:underline truncate">
                  <span className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-medium mr-1">{proprietarioDocLabel(d.kind)}</span>
                  {d.filename}
                </button>
                <button type="button" onClick={() => deletarDoc(d.id)} className="text-red-600 hover:text-red-700 text-xs">×</button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <select value={docKind} onChange={(e) => setDocKind(e.target.value as ProprietarioDocKind)}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs">
            {DOC_KINDS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
          </select>
          <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={onUpload} className="hidden" />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
            className="inline-flex items-center rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
            {uploading ? 'A enviar…' : '+ Doc'}
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    </li>
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
