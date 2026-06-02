'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Car, Pencil, Check, X } from 'lucide-react';
import type { ImovelFinanceiro as Fin } from '@/lib/imoveis/shared';

function eur(cents: number): string {
  return (cents / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 });
}

export default function ImovelFinanceiro({ fin }: { fin: Fin }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [valor, setValor] = useState((fin.visita_custo_cents / 100).toFixed(2).replace('.', ','));
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  async function guardar() {
    setSaving(true);
    try {
      const cents = Math.max(0, Math.round((parseFloat(valor.replace(',', '.')) || 0) * 100));
      await fetch('/api/financeiro/visit-cost', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cents }),
      });
      setEditing(false);
      startTransition(() => router.refresh());
    } finally {
      setSaving(false);
    }
  }

  const semRetorno = fin.won_count === 0;
  const lucroPos = fin.lucro_cents >= 0;

  return (
    <div className="space-y-4">
      {/* Cabeçalho + ROI */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Quanto este imóvel custou (despesas + visitas) face ao que rendeu (comissão líquida dos negócios ganhos ligados).
        </p>
        {fin.roi != null && (
          <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300 px-2.5 py-0.5 text-xs font-bold">
            ROI {fin.roi.toFixed(1)}x
          </span>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 p-3">
          <div className="text-[10px] uppercase tracking-wide text-emerald-700/80 dark:text-emerald-300/80">Rendeu (líquido)</div>
          <div className="text-xl font-extrabold text-emerald-700 dark:text-emerald-300 mt-0.5">{eur(fin.receita_cents)}</div>
        </div>
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10 p-3">
          <div className="text-[10px] uppercase tracking-wide text-red-700/80 dark:text-red-300/80">Custou (total)</div>
          <div className="text-xl font-extrabold text-red-700 dark:text-red-300 mt-0.5">{eur(fin.custo_total_cents)}</div>
        </div>
        <div className={`rounded-lg border p-3 ${lucroPos ? 'border-violet-200 bg-violet-50 dark:border-violet-500/30 dark:bg-violet-500/10' : 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'}`}>
          <div className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">{lucroPos ? 'Lucro' : 'Investido (sem retorno)'}</div>
          <div className={`text-xl font-extrabold mt-0.5 ${lucroPos ? 'text-violet-700 dark:text-violet-300' : 'text-amber-700 dark:text-amber-300'}`}>{eur(Math.abs(fin.lucro_cents))}</div>
        </div>
      </div>

      {semRetorno && fin.custo_total_cents > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Já investiste {eur(fin.custo_total_cents)} neste imóvel e ainda não há negócio ganho ligado — sem retorno até agora.
        </p>
      )}

      {/* Custos */}
      <div className="rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden">
        <div className="px-3 py-2 bg-slate-50 dark:bg-white/5 text-xs font-bold text-slate-600 dark:text-slate-300">Custos</div>
        <table className="w-full text-sm">
          <tbody className="divide-y divide-slate-100 dark:divide-white/5">
            {fin.despesas_por_categoria.map((d) => (
              <tr key={d.categoria}>
                <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{d.categoria} <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-white/10 rounded px-1.5 py-0.5">despesa</span></td>
                <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{eur(d.cents)}</td>
              </tr>
            ))}
            <tr>
              <td className="px-3 py-2 text-slate-700 dark:text-slate-200">
                <span className="inline-flex items-center gap-1.5"><Car className="w-3.5 h-3.5 text-slate-400" /> Visitas (combustível)</span>{' '}
                <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-white/10 rounded px-1.5 py-0.5">{fin.visitas} {fin.visitas === 1 ? 'visita' : 'visitas'} × {eur(fin.visita_custo_cents)}</span>
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-slate-700 dark:text-slate-200">{eur(fin.visitas_cents)}</td>
            </tr>
            <tr className="bg-slate-50 dark:bg-white/5">
              <td className="px-3 py-2 font-bold text-slate-800 dark:text-slate-100">Custo total</td>
              <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-800 dark:text-slate-100">{eur(fin.custo_total_cents)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Editor do custo por visita */}
      <div className="flex items-center gap-2 flex-wrap rounded-lg border border-dashed border-slate-300 dark:border-white/15 bg-slate-50 dark:bg-white/5 p-3 text-sm text-slate-600 dark:text-slate-300">
        <Car className="w-4 h-4 text-slate-400 shrink-0" />
        <span>Custo por visita (combustível):</span>
        {editing ? (
          <>
            <input
              type="number" step="0.01" min="0" inputMode="decimal" value={valor}
              onChange={(e) => setValor(e.target.value)}
              className="w-24 rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-white/10 px-2 py-1 text-sm text-slate-900 dark:text-slate-100"
              aria-label="Custo por visita em euros"
            />
            <span>€</span>
            <button type="button" onClick={guardar} disabled={saving} className="inline-flex items-center gap-1 rounded-md bg-violet-600 text-white px-2 py-1 text-xs font-medium hover:bg-violet-700 disabled:opacity-50">
              <Check className="w-3.5 h-3.5" /> Guardar
            </button>
            <button type="button" onClick={() => { setEditing(false); setValor((fin.visita_custo_cents / 100).toFixed(2).replace('.', ',')); }} className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-white/15 px-2 py-1 text-xs text-slate-600 dark:text-slate-300">
              <X className="w-3.5 h-3.5" /> Cancelar
            </button>
          </>
        ) : (
          <>
            <b className="text-slate-800 dark:text-slate-100">{eur(fin.visita_custo_cents)}</b>
            <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1 text-violet-600 dark:text-violet-400 hover:underline text-xs">
              <Pencil className="w-3.5 h-3.5" /> Alterar
            </button>
            <span className="text-xs text-slate-400">aplica-se a todos os imóveis; para custos exactos, lança em Despesas.</span>
          </>
        )}
      </div>

      {/* Rendimento */}
      {fin.won_count > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Rendimento = comissão líquida de {fin.won_count} {fin.won_count === 1 ? 'negócio ganho' : 'negócios ganhos'} ligado{fin.won_count === 1 ? '' : 's'} a este imóvel.
        </p>
      )}
    </div>
  );
}
