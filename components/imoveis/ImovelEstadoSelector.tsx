'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ESTADOS_IMOVEL, type ImovelEstado } from '@/lib/imoveis/shared';

interface Props {
  imovelId: string;
  estadoActual: ImovelEstado | string | null;
}

export default function ImovelEstadoSelector({ imovelId, estadoActual }: Props) {
  const router = useRouter();
  const [estado, setEstado] = useState<string>(estadoActual ?? 'em_avaliacao');
  const [loading, setLoading] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function alterar(novo: ImovelEstado) {
    if (novo === estado || loading) return;
    setLoading(novo);
    setErro(null);
    const anterior = estado;
    setEstado(novo); // optimista
    try {
      const res = await fetch(`/api/imoveis/${imovelId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: novo }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message ?? 'Erro a mudar estado');
      }
      router.refresh();
    } catch (err) {
      setEstado(anterior);
      setErro(err instanceof Error ? err.message : 'Erro');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {ESTADOS_IMOVEL.map((e) => {
          const selected = e.value === estado;
          const isLoading = loading === e.value;
          return (
            <button
              key={e.value}
              type="button"
              onClick={() => alterar(e.value)}
              disabled={loading !== null}
              title={e.descricao}
              className={
                'inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition disabled:opacity-50 ' +
                (selected ? e.pillSelected : e.pillIdle)
              }
            >
              {isLoading ? '…' : e.label}
            </button>
          );
        })}
      </div>
      {erro && <p className="text-xs text-red-600">{erro}</p>}
    </div>
  );
}
