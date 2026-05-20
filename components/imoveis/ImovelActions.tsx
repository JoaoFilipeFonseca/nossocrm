'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import NovoEventoModal from './NovoEventoModal';

interface Props {
  imovelId: string;
  imovelLabel: string;
}

export default function ImovelActions({ imovelId, imovelLabel }: Props) {
  const router = useRouter();
  const [eventoOpen, setEventoOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  async function handleDelete() {
    const res = await fetch(`/api/imoveis/${imovelId}`, { method: 'DELETE' });
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      throw new Error(json.message ?? 'Erro a apagar imóvel');
    }
    router.push('/imoveis');
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setEventoOpen(true)}
          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Evento
        </button>
        <Link
          href={`/imoveis/${imovelId}/editar`}
          className="inline-flex items-center rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Editar
        </Link>
        <button
          type="button"
          onClick={() => setDeleteOpen(true)}
          className="inline-flex items-center rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Apagar
        </button>
      </div>

      <NovoEventoModal imovelId={imovelId} open={eventoOpen} onClose={() => setEventoOpen(false)} />

      <DeleteConfirmModal
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        itemName={imovelLabel}
        itemType="imóvel"
        consequence="O imóvel e todo o seu histórico serão removidos permanentemente. Deals associados ficam sem imóvel ligado."
      />
    </>
  );
}
