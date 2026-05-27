'use client';

/**
 * CardActions — menu 3-pontinhos por automação em /automacoes.
 *
 * Sprint 3.2, commit 1.
 *
 * Permite Activar/Pausar/Eliminar/Editar sem entrar na automação.
 * Cada acção chama o mesmo endpoint REST que o builder usa.
 */

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Props {
  id: string;
  name: string;
  status: 'draft' | 'active' | 'paused' | 'archived';
}

export function CardActions({ id, name, status }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<null | string>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  async function call(path: string, method = 'POST') {
    setPending(path);
    try {
      const res = await fetch(path, { method });
      if (!res.ok && res.status !== 204) {
        const body = await res.json().catch(() => ({}));
        alert(`Erro: ${(body as { message?: string }).message ?? res.status}`);
      } else {
        router.refresh();
      }
    } finally {
      setPending(null);
      setOpen(false);
    }
  }

  async function handleActivate(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await call(`/api/automations/${id}/activate`);
  }

  async function handleDeactivate(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await call(`/api/automations/${id}/deactivate`);
  }

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const ok = window.confirm(`Apagar "${name}"? Remove triggers e histórico de execuções. Não pode ser desfeito.`);
    if (!ok) { setOpen(false); return; }
    await call(`/api/automations/${id}`, 'DELETE');
  }

  const canActivate = status === 'draft' || status === 'paused';
  const canDeactivate = status === 'active';

  return (
    <div ref={ref} className="relative" onClick={(e) => e.preventDefault()}>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="p-1 rounded hover:bg-slate-100 text-slate-500"
        aria-label="Acções"
        disabled={pending !== null}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
      </button>
      {open ? (
        <div className="absolute right-0 top-full mt-1 w-44 rounded-md border border-slate-200 bg-white shadow-lg z-20 py-1">
          <Link
            href={`/automacoes/${id}`}
            onClick={(e) => e.stopPropagation()}
            className="block w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            ✎ Abrir / editar
          </Link>
          {canActivate ? (
            <button type="button" onClick={handleActivate} className="block w-full text-left px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-50">
              ▶ Activar
            </button>
          ) : null}
          {canDeactivate ? (
            <button type="button" onClick={handleDeactivate} className="block w-full text-left px-3 py-1.5 text-sm text-amber-700 hover:bg-amber-50">
              ⏸ Pausar
            </button>
          ) : null}
          <div className="border-t border-slate-100 my-1"></div>
          <button type="button" onClick={handleDelete} className="block w-full text-left px-3 py-1.5 text-sm text-red-700 hover:bg-red-50">
            🗑 Eliminar
          </button>
        </div>
      ) : null}
    </div>
  );
}
