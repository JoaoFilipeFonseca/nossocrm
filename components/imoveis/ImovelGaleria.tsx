'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Foto {
  id: string;
  storage_path: string;
  url_publica: string | null;
  ordem: number;
  caption: string | null;
  is_principal: boolean;
}

interface Props {
  imovelId: string;
  fotos: Foto[];
}

export default function ImovelGaleria({ imovelId, fotos }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      for (const f of Array.from(files)) fd.append('files', f);
      const res = await fetch(`/api/imoveis/${imovelId}/fotos`, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Erro upload');
      if (json.errors?.length) setError(json.errors.join(' · '));
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function setPrincipal(fotoId: string) {
    await fetch(`/api/imoveis/${imovelId}/fotos/${fotoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_principal: true }),
    });
    startTransition(() => router.refresh());
  }

  async function deletar(fotoId: string) {
    if (!confirm('Apagar esta foto?')) return;
    await fetch(`/api/imoveis/${imovelId}/fotos/${fotoId}`, { method: 'DELETE' });
    startTransition(() => router.refresh());
  }

  async function reorder(fotoId: string, novaOrdem: number) {
    await fetch(`/api/imoveis/${imovelId}/fotos/${fotoId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ordem: novaOrdem }),
    });
    startTransition(() => router.refresh());
  }

  const sorted = [...fotos].sort((a, b) => a.ordem - b.ordem);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fotos ({fotos.length})</h2>
        <div>
          <input ref={inputRef} type="file" accept="image/*" multiple onChange={onUpload} className="hidden" />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading || pending}
            className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
            {uploading ? 'A enviar…' : '+ Fotos'}
          </button>
        </div>
      </div>

      {error && <div className="rounded-md bg-red-50 text-red-700 p-3 text-sm">{error}</div>}

      {sorted.length === 0 ? (
        <p className="text-sm text-slate-500 rounded-md border border-dashed border-slate-300 p-6 text-center">
          Sem fotos ainda. Carrega no botão acima para adicionar.
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {sorted.map((foto, idx) => (
            <div key={foto.id} className="relative group rounded-md overflow-hidden border border-slate-200 aspect-[4/3] bg-slate-100">
              {foto.url_publica ? (
                <Image src={foto.url_publica} alt={foto.caption ?? `Foto ${idx + 1}`} fill sizes="(max-width:768px) 50vw, 25vw" className="object-cover" />
              ) : (
                <div className="flex items-center justify-center h-full text-xs text-slate-400">sem url</div>
              )}

              {foto.is_principal && (
                <span className="absolute top-2 left-2 inline-flex items-center rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">★ Principal</span>
              )}

              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition opacity-0 group-hover:opacity-100 flex items-end justify-between p-2 gap-1">
                <div className="flex gap-1">
                  {!foto.is_principal && (
                    <button type="button" onClick={() => setPrincipal(foto.id)}
                      className="rounded bg-white/90 px-2 py-1 text-xs font-medium text-slate-900 hover:bg-white">★</button>
                  )}
                  {idx > 0 && (
                    <button type="button" onClick={() => reorder(foto.id, sorted[idx - 1].ordem - 1)}
                      className="rounded bg-white/90 px-2 py-1 text-xs text-slate-900">↑</button>
                  )}
                  {idx < sorted.length - 1 && (
                    <button type="button" onClick={() => reorder(foto.id, sorted[idx + 1].ordem + 1)}
                      className="rounded bg-white/90 px-2 py-1 text-xs text-slate-900">↓</button>
                  )}
                </div>
                <button type="button" onClick={() => deletar(foto.id)}
                  className="rounded bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-700">×</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
