'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const TIPOLOGIAS = ['T0', 'T1', 'T2', 'T3', 'T4', 'T5+', 'Loja', 'Armazem', 'Terreno'];
const ESTADOS = [
  { value: 'disponivel', label: 'Disponível' },
  { value: 'reservado', label: 'Reservado' },
  { value: 'vendido', label: 'Vendido' },
  { value: 'retirado', label: 'Retirado' },
  { value: 'em_avaliacao', label: 'Em avaliação' },
];
const TIPOS_NEGOCIO = [
  { value: 'venda', label: 'Venda' },
  { value: 'arrendamento', label: 'Arrendamento' },
  { value: 'ambos', label: 'Ambos' },
];

export default function NovoImovelPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    referencia: '',
    morada: '',
    freguesia: '',
    concelho: '',
    distrito: 'Porto',
    tipologia: '',
    area_util: '',
    preco_actual: '',
    estado: 'disponivel',
    tipo_negocio: 'venda',
    link_externo: '',
    notas_privadas: '',
  });

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        ...form,
        area_util: form.area_util ? Number(form.area_util) : null,
        preco_actual: form.preco_actual ? Number(form.preco_actual) : null,
      };
      const res = await fetch('/api/imoveis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Erro a criar imóvel');
      router.push(`/imoveis/${json.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-4">
        <Link href="/imoveis" className="text-sm text-blue-600 hover:underline">
          ← Imóveis
        </Link>
      </div>

      <h1 className="text-2xl font-semibold mb-6">Novo imóvel</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Referência interna">
          <input
            type="text"
            value={form.referencia}
            onChange={(e) => update('referencia', e.target.value)}
            placeholder="ex: FOC-2026-T2-BVT-001"
            className={inputCls}
          />
        </Field>

        <Field label="Morada">
          <input
            type="text"
            value={form.morada}
            onChange={(e) => update('morada', e.target.value)}
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Freguesia">
            <input
              type="text"
              value={form.freguesia}
              onChange={(e) => update('freguesia', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Concelho">
            <input
              type="text"
              value={form.concelho}
              onChange={(e) => update('concelho', e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Tipologia">
            <select
              value={form.tipologia}
              onChange={(e) => update('tipologia', e.target.value)}
              className={inputCls}
            >
              <option value="">—</option>
              {TIPOLOGIAS.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Área útil (m²)">
            <input
              type="number"
              step="0.1"
              value={form.area_util}
              onChange={(e) => update('area_util', e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Preço actual (€)">
            <input
              type="number"
              step="100"
              value={form.preco_actual}
              onChange={(e) => update('preco_actual', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Estado">
            <select
              value={form.estado}
              onChange={(e) => update('estado', e.target.value)}
              className={inputCls}
            >
              {ESTADOS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Tipo de negócio">
          <select
            value={form.tipo_negocio}
            onChange={(e) => update('tipo_negocio', e.target.value)}
            className={inputCls}
          >
            {TIPOS_NEGOCIO.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </Field>

        <Field label="Link externo (Idealista, Imovirtual)">
          <input
            type="url"
            value={form.link_externo}
            onChange={(e) => update('link_externo', e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field label="Notas privadas">
          <textarea
            value={form.notas_privadas}
            onChange={(e) => update('notas_privadas', e.target.value)}
            rows={3}
            className={inputCls}
          />
        </Field>

        {error && (
          <div className="rounded-md bg-red-50 text-red-700 p-3 text-sm">{error}</div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'A criar...' : 'Criar imóvel'}
          </button>
          <Link
            href="/imoveis"
            className="text-sm text-slate-600 hover:text-slate-900"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
