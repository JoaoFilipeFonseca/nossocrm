'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ImovelDraft } from '@/lib/imoveis/captar';

type CaptarResult = {
  draft: ImovelDraft;
  modelUsed: string;
  sourceLength: number;
};

export default function CaptarImovelPage() {
  const router = useRouter();
  const [kind, setKind] = useState<'text' | 'link'>('text');
  const [payload, setPayload] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CaptarResult | null>(null);
  const [draft, setDraft] = useState<ImovelDraft | null>(null);

  async function onExtract(e: React.FormEvent) {
    e.preventDefault();
    setExtracting(true);
    setError(null);
    setResult(null);
    setDraft(null);
    try {
      const res = await fetch('/api/imoveis/captar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Erro a extrair');
      setResult(json);
      setDraft(json.draft);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setExtracting(false);
    }
  }

  async function onCreate() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/imoveis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Erro a criar imóvel');
      router.push(`/imoveis/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setSaving(false);
    }
  }

  function updateField<K extends keyof ImovelDraft>(key: K, value: ImovelDraft[K]) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-4">
        <Link href="/imoveis" className="text-sm text-blue-600 hover:underline">
          ← Imóveis
        </Link>
      </div>

      <h1 className="text-2xl font-semibold mb-2">Captar imóvel com IA</h1>
      <p className="text-sm text-slate-500 mb-6">
        Cola um link de Idealista/Imovirtual/Casa Sapo, ou texto solto (mensagem WhatsApp, descrição). A IA extrai os campos para tu revisares antes de gravar.
      </p>

      <form onSubmit={onExtract} className="space-y-4">
        <div className="inline-flex rounded-md border border-slate-300 p-0.5 bg-slate-50">
          <button
            type="button"
            onClick={() => setKind('text')}
            className={`px-3 py-1.5 text-sm font-medium rounded ${kind === 'text' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            Texto
          </button>
          <button
            type="button"
            onClick={() => setKind('link')}
            className={`px-3 py-1.5 text-sm font-medium rounded ${kind === 'link' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
          >
            Link
          </button>
        </div>

        {kind === 'link' ? (
          <input
            type="url"
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder="https://www.idealista.pt/imovel/..."
            className={inputCls}
          />
        ) : (
          <textarea
            value={payload}
            onChange={(e) => setPayload(e.target.value)}
            placeholder="Cola aqui mensagem WhatsApp, descrição de imóvel, anúncio, etc."
            rows={8}
            className={inputCls}
          />
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={extracting || !payload.trim()}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {extracting ? 'A extrair…' : 'Extrair com IA'}
          </button>
          <Link href="/imoveis" className="text-sm text-slate-600 hover:text-slate-900">Cancelar</Link>
        </div>
      </form>

      {error && <div className="mt-4 rounded-md bg-red-50 text-red-700 p-3 text-sm">{error}</div>}

      {draft && result && (
        <div className="mt-8 border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">Preview do imóvel</h2>
              <p className="text-xs text-slate-500 mt-1">
                Modelo: {result.modelUsed} · {result.sourceLength} caracteres lidos
              </p>
            </div>
            <button
              type="button"
              onClick={onCreate}
              disabled={saving}
              className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? 'A gravar…' : 'Criar imóvel'}
            </button>
          </div>

          <p className="text-xs text-slate-500 mb-3">
            Cada campo mostra confiança da IA (verde ≥80, amarelo 50-79, vermelho &lt;50). Edita o que estiver errado antes de gravar.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <DraftField label="Referência" field="referencia" draft={draft} onChange={updateField} />
            <DraftField label="Morada" field="morada" draft={draft} onChange={updateField} />
            <DraftField label="Freguesia" field="freguesia" draft={draft} onChange={updateField} />
            <DraftField label="Concelho" field="concelho" draft={draft} onChange={updateField} />
            <DraftField label="Distrito" field="distrito" draft={draft} onChange={updateField} />
            <DraftField label="Tipologia" field="tipologia" draft={draft} onChange={updateField} />
            <DraftField label="Área útil (m²)" field="area_util" draft={draft} onChange={updateField} type="number" />
            <DraftField label="Área bruta (m²)" field="area_bruta" draft={draft} onChange={updateField} type="number" />
            <DraftField label="Ano construção" field="ano_construcao" draft={draft} onChange={updateField} type="number" />
            <DraftField label="Certificado energético" field="certificado_energetico" draft={draft} onChange={updateField} />
            <DraftField label="Preço actual (€)" field="preco_actual" draft={draft} onChange={updateField} type="number" />
            <DraftField label="Preço inicial (€)" field="preco_inicial" draft={draft} onChange={updateField} type="number" />
            <DraftField label="Estado" field="estado" draft={draft} onChange={updateField} />
            <DraftField label="Tipo de negócio" field="tipo_negocio" draft={draft} onChange={updateField} />
          </div>

          <div className="mt-3">
            <DraftField label="Link externo" field="link_externo" draft={draft} onChange={updateField} fullWidth />
          </div>
          <div className="mt-3">
            <DraftField label="Notas privadas" field="notas_privadas" draft={draft} onChange={updateField} fullWidth multiline />
          </div>
        </div>
      )}
    </div>
  );
}

interface DraftFieldProps {
  label: string;
  field: keyof ImovelDraft;
  draft: ImovelDraft;
  onChange: <K extends keyof ImovelDraft>(key: K, value: ImovelDraft[K]) => void;
  type?: 'text' | 'number';
  fullWidth?: boolean;
  multiline?: boolean;
}

function DraftField({ label, field, draft, onChange, type = 'text', multiline }: DraftFieldProps) {
  const value = draft[field];
  const conf = draft.confidence?.[field as string];
  const display = value == null ? '' : String(value);
  const dot = conf == null ? 'bg-slate-300' : conf >= 80 ? 'bg-green-500' : conf >= 50 ? 'bg-amber-500' : 'bg-red-500';

  function handle(raw: string) {
    if (type === 'number') {
      const n = raw === '' ? null : Number(raw);
      onChange(field, (Number.isFinite(n) ? n : null) as ImovelDraft[typeof field]);
    } else {
      onChange(field, (raw === '' ? null : raw) as ImovelDraft[typeof field]);
    }
  }

  return (
    <label className="block">
      <div className="flex items-center gap-2 mb-1">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} title={conf != null ? `${conf}% confiança` : 'sem confidence'} />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</span>
        {conf != null && <span className="text-[10px] text-slate-400">{conf}%</span>}
      </div>
      {multiline ? (
        <textarea
          value={display}
          onChange={(e) => handle(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      ) : (
        <input
          type={type === 'number' ? 'number' : 'text'}
          value={display}
          onChange={(e) => handle(e.target.value)}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      )}
    </label>
  );
}

const inputCls = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
