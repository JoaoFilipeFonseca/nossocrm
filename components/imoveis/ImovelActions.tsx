'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DeleteConfirmModal } from '@/components/ui/DeleteConfirmModal';
import NovoEventoModal from './NovoEventoModal';

interface Props {
  imovelId: string;
  imovelLabel: string;
  isTelegramActive?: boolean;
}

export default function ImovelActions({ imovelId, imovelLabel, isTelegramActive = false }: Props) {
  const router = useRouter();
  const [eventoOpen, setEventoOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [activeLoading, setActiveLoading] = useState(false);
  const [isActive, setIsActive] = useState(isTelegramActive);

  async function toggleActive() {
    setActiveLoading(true);
    try {
      const res = await fetch('/api/telegram/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imovel_id: isActive ? null : imovelId }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.message ?? 'Erro');
      }
      setIsActive(!isActive);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro a definir activo');
    } finally {
      setActiveLoading(false);
    }
  }

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
          onClick={toggleActive}
          disabled={activeLoading}
          title={isActive ? 'Próximos comandos do Telegram afectam este imóvel' : 'Define como imóvel para comandos do Telegram'}
          className={
            isActive
              ? 'inline-flex items-center rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50'
              : 'inline-flex items-center rounded-md border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50'
          }
        >
          {isActive ? '📌 Activo no Telegram' : '📌 Definir activo no Telegram'}
        </button>
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
