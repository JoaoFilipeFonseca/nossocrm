'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ImovelDraft } from '@/lib/imoveis/captar';

type CaptarResult = {
  draft: ImovelDraft;
  modelUsed: string;
  sourceLength: number;
  via?: string;
};

export default function CaptarImovelPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [kind, setKind] = useState<'text' | 'link' | 'file'>('text');
  const [payload, setPayload] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CaptarResult | null>(null);

  async function onExtract(e: React.FormEvent) {
    e.preventDefault();
    setExtracting(true);
    setError(null);
    setResult(null);
    try {
      let res: Response;
      if (kind === 'file') {
        if (!file) throw new Error('Selecciona um ficheiro');
        const fd = new FormData();
        fd.append('file', file);
        res = await fetch('/api/imoveis/captar', { method: 'POST', body: fd });
      } else {
        res = await fetch('/api/imoveis/captar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, payload }),
        });
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Erro a extrair');
      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setExtracting(false);
    }
  }

  async function onCreate() {
    if (!result?.draft) return;
    setSaving(true);
    setError(null);
    try {
      const payload = { ...result.draft, estado: 'em_avaliacao' };
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
      setSaving(false);
    }
  }

  const d = result?.draft;
  const c = d?.confidence ?? {};
  const filledCount = d ? Object.entries(d).filter(([k, v]) => k !== 'confidence' && v != null && v !== '' && !(Array.isArray(v) && v.length === 0)).length : 0;
  const high = Object.values(c).filter((v) => v >= 80).length;
  const med = Object.values(c).filter((v) => v >= 50 && v < 80).length;
  const low = Object.values(c).filter((v) => v > 0 && v < 50).length;

  return (
    <div className="p-6 max-w-3xl">
      <div className="mb-4">
        <Link href="/imoveis" className="text-sm text-blue-600 hover:underline">← Imóveis</Link>
      </div>

      <h1 className="text-2xl font-semibold mb-2">Captar imóvel com IA</h1>
      <p className="text-sm text-slate-500 mb-6">
        Cola um link (Idealista, Imovirtual, Casa Sapo, RE/MAX, Century 21, KW), ou texto solto. A IA extrai todos os campos e cria o imóvel em estado <strong>Em avaliação</strong> para tu revisares e completares.
      </p>

      <form onSubmit={onExtract} className="space-y-4">
        <div className="inline-flex rounded-md border border-slate-300 p-0.5 bg-slate-50">
          {(['text', 'link', 'file'] as const).map((k) => (
            <button key={k} type="button" onClick={() => setKind(k)}
              className={`px-3 py-1.5 text-sm font-medium rounded ${kind === k ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}>
              {k === 'text' ? 'Texto' : k === 'link' ? 'Link' : 'Foto / PDF'}
            </button>
          ))}
        </div>

        {kind === 'link' && (
          <input type="url" value={payload} onChange={(e) => setPayload(e.target.value)}
            placeholder="https://www.remax.pt/..." className={inputCls} />
        )}
        {kind === 'text' && (
          <textarea value={payload} onChange={(e) => setPayload(e.target.value)}
            placeholder="Cola aqui mensagem WhatsApp, descrição completa, anúncio, etc." rows={10} className={inputCls} />
        )}
        {kind === 'file' && (
          <div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-md border-2 border-dashed border-slate-300 p-8 text-center hover:border-blue-400 transition"
            >
              {file ? (
                <div>
                  <p className="text-sm font-medium text-slate-900">{file.name}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
                  </p>
                  <p className="text-xs text-blue-600 mt-2">Clique para mudar</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-700">📷 Carrega para escolher foto ou PDF</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Foto de anúncio, placard, caderneta predial, certificado energético… (máx 15 MB)
                  </p>
                </div>
              )}
            </button>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={extracting || (kind === 'file' ? !file : !payload.trim())}
            className="inline-flex items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {extracting ? 'A extrair…' : 'Extrair com IA'}
          </button>
          <Link href="/imoveis" className="text-sm text-slate-600 hover:text-slate-900">Cancelar</Link>
        </div>
      </form>

      {error && <div className="mt-4 rounded-md bg-red-50 text-red-700 p-3 text-sm">{error}</div>}

      {d && result && (
        <div className="mt-8 border-t pt-6">
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <div>
              <h2 className="text-lg font-semibold">Preview — {filledCount} campos preenchidos</h2>
              <p className="text-xs text-slate-500 mt-1">
                {result.modelUsed} · {result.sourceLength} chars
                {result.via && ` · fetch via ${result.via}`}
              </p>
              <div className="flex items-center gap-3 mt-2 text-xs">
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-green-500" /> {high} alta</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-amber-500" /> {med} média</span>
                <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-red-500" /> {low} baixa</span>
              </div>
            </div>
            <button type="button" onClick={onCreate} disabled={saving}
              className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {saving ? 'A criar…' : 'Criar e abrir para rever'}
            </button>
          </div>

          <Group title="Identificação">
            <Pair label="Tipo / Subtipo" v={[d.tipo, d.subtipo].filter(Boolean).join(' · ')} conf={c.tipo} />
            <Pair label="Tipologia" v={d.tipologia} conf={c.tipologia} />
            <Pair label="Negócio" v={d.tipo_negocio} conf={c.tipo_negocio} />
            <Pair label="Estado conservação" v={d.estado_conservacao} conf={c.estado_conservacao} />
          </Group>

          <Group title="Localização">
            <Pair label="Morada" v={d.morada} conf={c.morada} />
            <Pair label="Código postal" v={d.codigo_postal} conf={c.codigo_postal} />
            <Pair label="Freguesia / Concelho" v={[d.freguesia, d.concelho].filter(Boolean).join(' · ')} conf={c.concelho} />
            <Pair label="Distrito" v={d.distrito} conf={c.distrito} />
          </Group>

          <Group title="Áreas e divisões">
            <Pair label="Área útil (m²)" v={d.area_util} conf={c.area_util} />
            <Pair label="Área bruta (m²)" v={d.area_bruta} conf={c.area_bruta} />
            <Pair label="Área terreno (m²)" v={d.area_terreno} conf={c.area_terreno} />
            <Pair label="Quartos / Suites / WCs" v={[d.quartos, d.quartos_suite, d.wcs].filter((x) => x != null).join(' · ')} conf={c.quartos} />
            <Pair label="Ano construção / remod." v={[d.ano_construcao, d.ano_remodelacao].filter(Boolean).join(' · ')} conf={c.ano_construcao} />
          </Group>

          <Group title="Energia e infraestruturas">
            <Pair label="Certificado energético" v={d.certificado_energetico} conf={c.certificado_energetico} />
            <Pair label="Aquecimento" v={d.aquecimento} conf={c.aquecimento} />
            <Pair label="Painéis solares" v={d.paineis_solares} conf={c.paineis_solares} />
            <Pair label="Orientação / Vista" v={[d.orientacao, d.vista].filter(Boolean).join(' · ')} conf={c.vista} />
          </Group>

          <Group title="Preços">
            <Pair label="Preço actual (€)" v={d.preco_actual} conf={c.preco_actual} />
            <Pair label="Preço inicial (€)" v={d.preco_inicial} conf={c.preco_inicial} />
            <Pair label="Condomínio mensal (€)" v={d.condominio_mensal} conf={c.condominio_mensal} />
            <Pair label="IMI anual (€)" v={d.imi_anual} conf={c.imi_anual} />
          </Group>

          {d.destaques && d.destaques.length > 0 && (
            <Group title={`Destaques (${d.destaques.length})`}>
              <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
                {d.destaques.map((x, i) => <li key={i}>{x}</li>)}
              </ul>
            </Group>
          )}

          {d.caracteristicas && Object.keys(d.caracteristicas).filter((k) => d.caracteristicas[k]).length > 0 && (
            <Group title={`Equipamentos detectados (${Object.keys(d.caracteristicas).filter((k) => d.caracteristicas[k]).length})`}>
              <div className="flex flex-wrap gap-2">
                {Object.keys(d.caracteristicas).filter((k) => d.caracteristicas[k]).map((k) => (
                  <span key={k} className="inline-flex items-center rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-medium">✓ {k.replace(/_/g, ' ')}</span>
                ))}
              </div>
            </Group>
          )}

          {d.descricao_longa && (
            <Group title="Descrição (preview)">
              <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-6">{d.descricao_longa}</p>
            </Group>
          )}
        </div>
      )}
    </div>
  );
}

const inputCls = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">{title}</h3>
      {children}
    </div>
  );
}

function Pair({ label, v, conf }: { label: string; v: string | number | null | undefined; conf?: number }) {
  if (v == null || v === '') return null;
  const dot = conf == null ? 'bg-slate-300' : conf >= 80 ? 'bg-green-500' : conf >= 50 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center justify-between gap-3 py-1 text-sm border-b border-slate-100 last:border-0">
      <span className="text-slate-600 min-w-0 flex items-center gap-2">
        <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
        {label}
      </span>
      <span className="text-slate-900 font-medium text-right truncate">{v}</span>
    </div>
  );
}
