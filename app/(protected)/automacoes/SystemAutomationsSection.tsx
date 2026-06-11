'use client';

import React, { useEffect, useState } from 'react';
import { Play, Edit2, Power, PowerOff, CheckCircle2, XCircle, Clock, Settings2, RefreshCw, ListTree, ChevronDown, ChevronRight, SlidersHorizontal } from 'lucide-react';
import { SYSTEM_FLOWS, SYSTEM_FLOW_COMMON_NOTE } from '@/lib/automations/systemFlows';

type SystemAutomation = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string;
  cron_job_name: string;
  cron_expression: string;
  function_url: string;
  enabled: boolean;
  params: Record<string, unknown>;
  last_run_at: string | null;
  last_run_ok: boolean | null;
  last_run_error: string | null;
  run_count: number;
  fail_count: number;
  updated_at: string;
};

function timeAgo(iso: string | null): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d`;
}

// Tradução básica de cron expressions comuns
function describeCron(expr: string): string {
  const e = expr.trim();
  if (e === '0 3 * * 0') return 'Todos os domingos às 03h00';
  if (e === '0 7 * * 1-5') return 'Seg–Sex às 07h00';
  if (e === '*/5 * * * *') return 'A cada 5 minutos';
  if (e === '* * * * *') return 'A cada minuto';
  if (e === '*/15 * * * *') return 'A cada 15 minutos';
  if (e === '0 * * * *') return 'A cada hora (minuto 0)';
  if (e === '0 0 * * *') return 'Todos os dias às 00h00';
  return e;
}

export const SystemAutomationsSection: React.FC = () => {
  const [items, setItems] = useState<SystemAutomation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingParams, setEditingParams] = useState<string | null>(null);
  const [paramsValue, setParamsValue] = useState('');
  // SYS-FLOW: que automação tem o fluxo aberto (vê-se a montagem passo a passo).
  const [openFlow, setOpenFlow] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/automacoes/sistema', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        if (Array.isArray(j.items)) setItems(j.items);
        else if (j.error) setError(j.error);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const callAction = async (key: string, body: object) => {
    setBusy(key);
    try {
      const res = await fetch(`/api/automacoes/sistema?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(j.error || 'Erro');
        return false;
      }
      return true;
    } finally {
      setBusy(null);
    }
  };

  const toggle = async (it: SystemAutomation) => {
    const ok = await callAction(it.key, { action: 'toggle', enabled: !it.enabled });
    if (ok) setItems((arr) => arr.map((x) => x.key === it.key ? { ...x, enabled: !it.enabled } : x));
  };

  const saveSchedule = async (it: SystemAutomation) => {
    const expr = editValue.trim();
    if (!expr) return;
    const ok = await callAction(it.key, { action: 'schedule', cron_expression: expr });
    if (ok) {
      setItems((arr) => arr.map((x) => x.key === it.key ? { ...x, cron_expression: expr } : x));
      setEditing(null);
    }
  };

  const saveParams = async (it: SystemAutomation) => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(paramsValue || '{}');
    } catch {
      alert('JSON inválido');
      return;
    }
    const ok = await callAction(it.key, { action: 'params', params: parsed });
    if (ok) {
      setItems((arr) => arr.map((x) => x.key === it.key ? { ...x, params: parsed } : x));
      setEditingParams(null);
    }
  };

  const trigger = async (it: SystemAutomation) => {
    if (!confirm(`Disparar "${it.name}" agora?`)) return;
    const ok = await callAction(it.key, { action: 'trigger' });
    if (ok) alert('✓ Disparada. Próximas execuções no histórico em segundos.');
  };

  if (loading) {
    return <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 mb-6">A carregar automações de sistema...</div>;
  }
  if (error) {
    return <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 mb-6">Erro: {error}</div>;
  }
  if (items.length === 0) return null;

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wide flex items-center gap-2">
            <Settings2 className="h-4 w-4" /> Sistema ({items.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Automações operacionais do CRM. Vê o fluxo de cada uma, liga/desliga, ajusta horário ou parâmetros sem código.
          </p>
        </div>
        <button onClick={load} className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">
          <RefreshCw className="h-3 w-3" /> Recarregar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {items.map((it) => (
          <div
            key={it.key}
            className={`rounded-lg border p-4 ${it.enabled ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-200 opacity-75'}`}
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xl">{it.icon}</span>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{it.name}</h3>
                  <code className="text-[10px] text-slate-400">{it.key}</code>
                </div>
              </div>
              <button
                onClick={() => toggle(it)}
                disabled={busy === it.key}
                className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md border transition-colors ${it.enabled
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-slate-300 bg-white text-slate-500 hover:bg-slate-100'
                  }`}
              >
                {it.enabled ? <><Power className="h-3 w-3" /> ON</> : <><PowerOff className="h-3 w-3" /> OFF</>}
              </button>
            </div>

            {it.description && <p className="text-xs text-slate-600 mb-3">{it.description}</p>}

            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Schedule</span>
                {editing === it.key ? (
                  <div className="flex gap-1">
                    <input
                      autoFocus
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') saveSchedule(it); if (e.key === 'Escape') setEditing(null); }}
                      placeholder="* * * * *"
                      className="px-2 py-0.5 text-xs border border-slate-300 rounded font-mono w-32"
                    />
                    <button onClick={() => saveSchedule(it)} className="text-emerald-600 text-xs px-1">✓</button>
                    <button onClick={() => setEditing(null)} className="text-slate-400 text-xs px-1">✕</button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditing(it.key); setEditValue(it.cron_expression); }}
                    className="text-slate-700 font-mono hover:underline inline-flex items-center gap-1"
                  >
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded">{it.cron_expression}</code>
                    <Edit2 className="h-3 w-3 text-slate-400" />
                  </button>
                )}
              </div>
              <div className="text-[10px] text-slate-400 text-right -mt-1">{describeCron(it.cron_expression)}</div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Parâmetros</span>
                {editingParams === it.key ? (
                  <div className="flex flex-col gap-1 w-full ml-3">
                    <textarea
                      autoFocus
                      value={paramsValue}
                      onChange={(e) => setParamsValue(e.target.value)}
                      rows={3}
                      className="px-2 py-1 text-xs border border-slate-300 rounded font-mono"
                    />
                    <div className="flex justify-end gap-1">
                      <button onClick={() => saveParams(it)} className="text-emerald-600 text-xs px-2">Gravar</button>
                      <button onClick={() => setEditingParams(null)} className="text-slate-400 text-xs px-2">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setEditingParams(it.key); setParamsValue(JSON.stringify(it.params, null, 2)); }}
                    className="text-slate-700 hover:underline inline-flex items-center gap-1"
                  >
                    <code className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{Object.keys(it.params).length} chave(s)</code>
                    <Edit2 className="h-3 w-3 text-slate-400" />
                  </button>
                )}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <span className="text-slate-500 inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" /> Última corrida
                </span>
                <span className="text-slate-700">
                  {it.last_run_at ? `há ${timeAgo(it.last_run_at)}` : 'nunca'}
                  {it.last_run_ok === true && <CheckCircle2 className="h-3 w-3 text-emerald-500 inline ml-1" />}
                  {it.last_run_ok === false && <XCircle className="h-3 w-3 text-rose-500 inline ml-1" />}
                </span>
              </div>
              {it.run_count > 0 && (
                <div className="text-[10px] text-slate-400 text-right">
                  {it.run_count} execuções{it.fail_count > 0 && <span className="text-rose-500"> · {it.fail_count} falhas</span>}
                </div>
              )}

              <div className="flex gap-2 mt-2">
                {SYSTEM_FLOWS[it.key] && (
                  <button
                    onClick={() => setOpenFlow(openFlow === it.key ? null : it.key)}
                    aria-expanded={openFlow === it.key}
                    className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md border border-slate-300 hover:border-violet-400 hover:bg-violet-50 text-slate-700 hover:text-violet-700 transition-colors"
                  >
                    <ListTree className="h-3 w-3" /> {openFlow === it.key ? 'Fechar fluxo' : 'Ver fluxo'}
                    {openFlow === it.key ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                  </button>
                )}
                <button
                  onClick={() => trigger(it)}
                  disabled={busy === it.key}
                  className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md border border-slate-300 hover:border-violet-400 hover:bg-violet-50 text-slate-700 hover:text-violet-700 transition-colors disabled:opacity-50"
                >
                  <Play className="h-3 w-3" /> Disparar agora
                </button>
              </div>

              {/* SYS-FLOW: a montagem passo a passo, na linguagem das outras automações */}
              {openFlow === it.key && SYSTEM_FLOWS[it.key] && (
                <div className="mt-3 rounded-md border border-violet-200 bg-violet-50/50 p-3">
                  <ol className="space-y-2">
                    {SYSTEM_FLOWS[it.key].steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="shrink-0 w-5 h-5 rounded-full bg-white border border-violet-200 text-violet-700 text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-slate-900">
                            <span className="mr-1">{step.icon}</span>{step.title}
                          </div>
                          <p className="text-[11px] text-slate-600 leading-snug">{step.detail}</p>
                          {step.params && step.params.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {step.params.map((p) => (
                                <span key={p} className="inline-flex items-center gap-0.5 text-[10px] font-mono bg-white border border-violet-200 text-violet-700 rounded px-1.5 py-0.5">
                                  <SlidersHorizontal className="h-2.5 w-2.5" /> {p}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                  {SYSTEM_FLOWS[it.key].note && (
                    <p className="mt-2 text-[11px] text-violet-800 font-medium">{SYSTEM_FLOWS[it.key].note}</p>
                  )}
                  <p className="mt-2 pt-2 border-t border-violet-200 text-[10px] text-slate-500 leading-snug">
                    {SYSTEM_FLOW_COMMON_NOTE}
                  </p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
