'use client';

/**
 * Financeiro — NS-1. Hub com dois separadores: Visão de Gestor + Despesas.
 * A ficha por angariação (ganho líquido real) vive no detalhe de cada negócio.
 */
import React, { useState } from 'react';
import { LineChart, Receipt } from 'lucide-react';
import { GestorPanel } from './GestorPanel';
import { DespesasPage } from './DespesasPage';

type Tab = 'gestor' | 'despesas';

export function FinanceiroPage() {
  const [tab, setTab] = useState<Tab>('gestor');

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      <header>
        <h1 className="text-xl font-bold font-display text-slate-900 dark:text-white">Financeiro</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Os números de tudo — do negócio inteiro a cada despesa.</p>
      </header>

      <div className="inline-flex gap-1 p-1 rounded-xl bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10">
        <button
          type="button"
          onClick={() => setTab('gestor')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            tab === 'gestor' ? 'bg-primary-600 text-white' : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          <LineChart size={16} aria-hidden="true" /> Visão de Gestor
        </button>
        <button
          type="button"
          onClick={() => setTab('despesas')}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${
            tab === 'despesas' ? 'bg-primary-600 text-white' : 'text-slate-600 dark:text-slate-300'
          }`}
        >
          <Receipt size={16} aria-hidden="true" /> Despesas
        </button>
      </div>

      {tab === 'gestor' ? <GestorPanel /> : <DespesasPage embedded />}
    </div>
  );
}
