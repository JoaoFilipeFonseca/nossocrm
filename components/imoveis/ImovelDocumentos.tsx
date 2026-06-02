'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface Documento {
  id: string;
  kind: string;
  filename: string;
  bytes: number | null;
  mime_type: string | null;
  uploaded_at: string;
}

interface Props {
  imovelId: string;
  documentos: Documento[];
}

const KIND_OPTIONS = [
  { v: 'caderneta', l: 'Caderneta predial' },
  { v: 'certidao_predial', l: 'Certidão registo predial' },
  { v: 'licenca_utilizacao', l: 'Licença de utilização' },
  { v: 'fth', l: 'Ficha técnica de habitação' },
  { v: 'ce', l: 'Certificado energético' },
  { v: 'planta', l: 'Planta' },
  { v: 'memoria_descritiva', l: 'Memória descritiva' },
  { v: 'distrato_bancario', l: 'Distrato bancário' },
  { v: 'declaracao_condominio', l: 'Declaração condomínio' },
  { v: 'preferencia', l: 'Direito de preferência' },
  { v: 'cmi', l: 'Contrato de Mediação (CMI)' },
  { v: 'mandato', l: 'Mandato' },
  { v: 'outro', l: 'Outro' },
];

function kindLabel(kind: string) {
  return KIND_OPTIONS.find((k) => k.v === kind)?.l ?? kind;
}

function formatBytes(b: number | null): string {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function ImovelDocumentos({ imovelId, documentos }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [kind, setKind] = useState('caderneta');
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
      fd.append('kind', kind);
      const res = await fetch(`/api/imoveis/${imovelId}/documentos`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Erro upload');
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function abrir(docId: string) {
    const res = await fetch(`/api/imoveis/${imovelId}/documentos/${docId}`);
    const json = await res.json();
    if (json.url) window.open(json.url, '_blank', 'noopener,noreferrer');
  }

  async function deletar(docId: string) {
    if (!confirm('Apagar este documento?')) return;
    await fetch(`/api/imoveis/${imovelId}/documentos/${docId}`, { method: 'DELETE' });
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="block text-xs font-medium uppercase tracking-wide text-slate-600 mb-1">Tipo</label>
          <select value={kind} onChange={(e) => setKind(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm">
            {KIND_OPTIONS.map((k) => <option key={k.v} value={k.v}>{k.l}</option>)}
          </select>
        </div>
        <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={onUpload} className="hidden" />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {uploading ? 'A enviar…' : '+ Documento'}
        </button>
      </div>

      {error && <div className="rounded-md bg-red-50 text-red-700 p-3 text-sm">{error}</div>}

      {documentos.length === 0 ? (
        <p className="text-sm text-slate-500 rounded-md border border-dashed border-slate-300 p-6 text-center">
          Sem documentos ainda.
        </p>
      ) : (
        <ul className="space-y-2">
          {documentos.map((d) => (
            <li key={d.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3 hover:border-slate-300">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 px-2 py-0.5 text-xs font-medium">{kindLabel(d.kind)}</span>
                  <button type="button" onClick={() => abrir(d.id)} className="text-sm font-medium text-slate-800 hover:underline truncate">
                    {d.filename}
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {formatBytes(d.bytes)} · {new Date(d.uploaded_at).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon' })}
                </p>
              </div>
              <button type="button" onClick={() => deletar(d.id)}
                className="text-red-600 hover:text-red-700 text-sm">Apagar</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
