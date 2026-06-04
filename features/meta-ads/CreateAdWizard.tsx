'use client';

/**
 * MA-CREATE (Tier 4) — construtor de anúncios no CRM. Wizard por fases.
 * FASE 1 (esta): passo Campanha — objectivo (Leads/Tráfego/Interação) + nome +
 * defaults travados do João; cria a campanha EM PAUSA na Meta (audit).
 * As fases seguintes (Conjunto, Anúncio, Formulário) acrescentam-se a este shell.
 */
import React, { useCallback, useState } from 'react';
import { X, Target, MousePointerClick, MessageCircle, AlertTriangle, Check } from 'lucide-react';

type Objective = 'leads' | 'trafego' | 'interacao';

const OBJECTIVES: { key: Objective; label: string; icon: typeof Target; hint: string }[] = [
  { key: 'leads', label: 'Leads', icon: Target, hint: 'Recolher contactos (formulário ou site).' },
  { key: 'trafego', label: 'Tráfego', icon: MousePointerClick, hint: 'Levar pessoas a um site ou página.' },
  { key: 'interacao', label: 'Interação', icon: MessageCircle, hint: 'Mensagens, comentários e interesse.' },
];

// Defaults travados (decisão do João) — mostrados como chips informativos.
const LOCKED = ['🏠 Imobiliário', '🇵🇹 Portugal', '💶 Orçamento no conjunto', '🚫 Sem partilha de 20%', '🛒 Leilão'];

export function CreateAdWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [objective, setObjective] = useState<Objective>('leads');
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const create = useCallback(async () => {
    if (!name.trim()) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/meta-ads/campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), objective }),
      });
      const j = await res.json();
      if (!res.ok || j.error) {
        setErr(j.error || 'Não foi possível criar a campanha.');
        return;
      }
      setCreatedId(j.campaign_id);
    } catch {
      setErr('Não foi possível criar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  }, [name, objective]);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="Novo anúncio">
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-dark-card shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 dark:border-white/10 bg-white/95 dark:bg-dark-card/95 px-5 py-3 backdrop-blur">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Novo anúncio</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">Passo 1 de 3 · Campanha</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {createdId ? (
          <div className="space-y-4 p-5">
            <div className="flex flex-col items-center gap-2 py-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
                <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">Campanha criada em pausa</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Fica <b>em pausa</b> (não gasta nada). O <b>conjunto</b> e o <b>anúncio</b> chegam nas próximas fases do construtor; entretanto podes completá-la no Gestor de Anúncios. Aparece na lista após o próximo sync.
              </p>
              <p className="text-[11px] text-slate-400">ID: {createdId}</p>
            </div>
            <button onClick={onCreated} className="w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white hover:bg-violet-700">Concluir</button>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            {/* Objectivo */}
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Objectivo</p>
              <div className="space-y-2">
                {OBJECTIVES.map((o) => {
                  const Icon = o.icon;
                  const sel = objective === o.key;
                  return (
                    <button
                      key={o.key}
                      onClick={() => setObjective(o.key)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                        sel
                          ? 'border-violet-500 bg-violet-50 dark:bg-violet-600/10'
                          : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <Icon className={`h-5 w-5 shrink-0 ${sel ? 'text-violet-600 dark:text-violet-300' : 'text-slate-400'}`} />
                      <span className="min-w-0">
                        <span className={`block text-sm font-bold ${sel ? 'text-violet-700 dark:text-violet-200' : 'text-slate-800 dark:text-slate-200'}`}>{o.label}</span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">{o.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Nome */}
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Nome da campanha</label>
              <input
                value={name}
                maxLength={200}
                onChange={(e) => setName(e.target.value)}
                placeholder="[Leads] Moradia Seroa V3 — Junho"
                className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <p className="mt-1 text-[11px] text-slate-400">Sugestão: padrão [Tipo] Imóvel — Mês.</p>
            </div>

            {/* Defaults travados */}
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Definições fixas (automáticas)</p>
              <div className="flex flex-wrap gap-1.5">
                {LOCKED.map((l) => (
                  <span key={l} className="rounded-full border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">{l}</span>
                ))}
              </div>
            </div>

            <div className="flex gap-2.5 rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Cria a campanha <b>em pausa</b> na Meta (não gasta nada). Só publicas tu, quando estiver completa.</p>
            </div>

            {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}

            <div className="flex gap-2">
              <button onClick={onClose} className="flex-1 rounded-lg bg-slate-100 dark:bg-white/5 px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200">Cancelar</button>
              <button
                onClick={() => void create()}
                disabled={saving || !name.trim()}
                className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-40"
              >
                {saving ? 'A criar...' : 'Criar campanha (em pausa)'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
