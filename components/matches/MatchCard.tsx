'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface MatchCardProps {
  id: string;
  score: number;
  status: string;
  reason: Record<string, unknown>;
  procura: {
    nome: string | null;
    telefone: string | null;
    tipologia: string | null;
    zona: string | null;
    concelho: string | null;
    preco: number | null;
    intent_source: string;
  };
  imovel: {
    id: string;
    label: string;
    tipologia: string | null;
    concelho: string | null;
    preco: number | null;
  };
}

function formatPreco(v: number | null): string {
  if (!v) return '—';
  return new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 0 }).format(v) + '€';
}

function scoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-100 text-emerald-700 border-emerald-300';
  if (score >= 60) return 'bg-blue-100 text-blue-700 border-blue-300';
  if (score >= 50) return 'bg-amber-100 text-amber-700 border-amber-300';
  return 'bg-slate-100 text-slate-600 border-slate-300';
}

export default function MatchCard({ id, score, status, reason, procura, imovel }: MatchCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(false);

  async function mudaStatus(novo: string) {
    setLoading(true);
    try {
      const res = await fetch(`/api/matches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: novo }),
      });
      if (!res.ok) throw new Error('Erro');
      if (novo === 'ignorado') setHidden(true);
      else router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (hidden) return null;

  const breakdown: string[] = [];
  if (typeof reason.tipologia === 'number' && reason.tipologia > 0) breakdown.push(`Tipologia +${reason.tipologia}`);
  const zona = reason.zona as { pts?: number; label?: string } | undefined;
  if (zona?.pts) breakdown.push(`${zona.label} +${zona.pts}`);
  const preco = reason.preco as { pts?: number; label?: string } | undefined;
  if (preco?.pts) breakdown.push(`${preco.label} +${preco.pts}`);
  const car = reason.caracteristicas as { pts?: number; matched?: string[] } | undefined;
  if (car?.pts) breakdown.push(`${car.matched?.join(', ')} +${car.pts}`);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${scoreColor(score)}`}>
          {score} pts
        </div>
        <div className="text-xs text-slate-500">
          {status !== 'novo' && <span className="capitalize px-2 py-0.5 rounded bg-slate-100">{status}</span>}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-3">
        <div>
          <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">Procura</div>
          <div className="text-sm font-medium text-slate-900">
            {procura.nome ?? 'Sem nome'}
            {procura.telefone && <span className="text-slate-500 font-normal"> · {procura.telefone}</span>}
          </div>
          <div className="text-xs text-slate-600 mt-1">
            {procura.tipologia && <span className="font-medium">{procura.tipologia}</span>}
            {procura.zona && ` em ${procura.zona}`}
            {!procura.zona && procura.concelho && ` em ${procura.concelho}`}
            {procura.preco && ` · até ${formatPreco(procura.preco)}`}
          </div>
          <div className="text-[10px] text-slate-400 mt-0.5">{procura.intent_source}</div>
        </div>

        <div className="md:border-l md:pl-4 border-slate-200">
          <div className="text-[11px] uppercase tracking-wide text-emerald-700 mb-1">Bate com</div>
          <Link href={`/imoveis/${imovel.id}`} className="text-sm font-medium text-blue-700 hover:underline">
            {imovel.label}
          </Link>
          <div className="text-xs text-slate-600 mt-1">
            {imovel.tipologia && <span className="font-medium">{imovel.tipologia}</span>}
            {imovel.concelho && ` · ${imovel.concelho}`}
            {imovel.preco && ` · ${formatPreco(imovel.preco)}`}
          </div>
        </div>
      </div>

      {breakdown.length > 0 && (
        <div className="text-xs text-slate-600 italic mb-3">{breakdown.join(' · ')}</div>
      )}

      <div className="flex flex-wrap gap-2">
        {status === 'novo' && (
          <button
            type="button" onClick={() => mudaStatus('visto')} disabled={loading}
            className="text-xs rounded-md border border-slate-300 px-2 py-1 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >Marcar visto</button>
        )}
        <button
          type="button" onClick={() => mudaStatus('contactado')} disabled={loading}
          className="text-xs rounded-md bg-emerald-600 px-2 py-1 text-white hover:bg-emerald-700 disabled:opacity-50"
        >Marcar contactado</button>
        <button
          type="button" onClick={() => mudaStatus('ignorado')} disabled={loading}
          className="text-xs rounded-md border border-red-300 px-2 py-1 text-red-700 hover:bg-red-50 disabled:opacity-50"
        >Ignorar</button>
      </div>
    </div>
  );
}
