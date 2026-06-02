'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, AlertTriangle, XCircle, HelpCircle } from 'lucide-react';
import { type ImovelCmi, type ImovelDocumento, type CmiCountdownState, type ImovelAcompanhamento, CMI_TIPOS, cmiCountdown } from '@/lib/imoveis/shared';

interface Props {
  imovelId: string;
  cmis: ImovelCmi[];
  /** Data do servidor (ISO) para a contagem ser determinista em SSR↔hidratação. */
  nowISO: string;
  /** Sinais do imóvel (leads/visitas/propostas) — mostrados no CMI activo. */
  acompanhamento: ImovelAcompanhamento;
  /** Documentos do imóvel do tipo CMI, para ligar ao registo. */
  documentosCmi: ImovelDocumento[];
}

function Kpi({ n, l, bad }: { n: number; l: string; bad?: boolean }) {
  return (
    <div className={`flex-1 min-w-[88px] rounded-lg border px-3 py-2 ${bad ? 'border-red-200 bg-red-50 dark:border-red-500/30 dark:bg-red-500/10' : 'border-slate-200 dark:border-white/10'}`}>
      <div className={`text-lg font-extrabold ${bad ? 'text-red-700 dark:text-red-300' : 'text-slate-900 dark:text-slate-100'}`}>{n}</div>
      <div className="text-[10px] uppercase tracking-wide text-slate-400">{l}</div>
    </div>
  );
}

function Acompanhamento({ a }: { a: ImovelAcompanhamento }) {
  return (
    <div className="mt-3 border-t border-dashed border-slate-200 dark:border-white/10 pt-3">
      <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mb-2">Acompanhamento</p>
      <div className="flex gap-2 flex-wrap">
        <Kpi n={a.leads} l="Negócios" bad={a.leads === 0} />
        <Kpi n={a.visitas} l="Visitas" bad={a.visitas === 0} />
        <Kpi n={a.propostas} l="Propostas" bad={a.propostas === 0} />
      </div>
      {a.diasSemVisita != null && a.diasSemVisita >= 14 && (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Há {a.diasSemVisita} dias sem visitas — altura de agir (rever preço/fotos, reactivar anúncio).</p>
      )}
      {a.visitas === 0 && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Ainda sem visitas registadas neste imóvel.</p>
      )}
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Lisbon',
  });
}

const STATE_STYLE: Record<CmiCountdownState, { cls: string; bar: string }> = {
  ok: { cls: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-300 dark:border-green-500/30', bar: '#22c55e' },
  warn: { cls: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30', bar: '#f59e0b' },
  danger: { cls: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30', bar: '#ef4444' },
  expired: { cls: 'bg-red-50 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/40', bar: '#ef4444' },
  none: { cls: 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/10', bar: '#cbd5e1' },
};

function Countdown({ dataFim, nowISO }: { dataFim: string | null; nowISO: string }) {
  const { state, days } = cmiCountdown(dataFim, nowISO);
  const st = STATE_STYLE[state];
  const Icon = state === 'expired' ? XCircle : state === 'none' ? HelpCircle : state === 'ok' ? Clock : AlertTriangle;

  let big: string;
  let lbl: string;
  if (state === 'none') { big = 'Sem prazo'; lbl = 'definir validade para activar alertas'; }
  else if (state === 'expired') { big = 'Expirado'; lbl = `há ${Math.abs(days ?? 0)} dias · ${fmtDate(dataFim)}`; }
  else {
    big = `${days} dia${days === 1 ? '' : 's'}`;
    lbl = state === 'danger' ? `faltam — falar com o proprietário · ${fmtDate(dataFim)}` : `faltam até acabar · ${fmtDate(dataFim)}`;
  }

  // progresso visual só quando há prazo e ainda não expirou (≈ 180 dias de janela)
  const pct = state === 'none' ? 0 : state === 'expired' ? 100 : Math.min(100, Math.max(4, Math.round((1 - (days ?? 0) / 180) * 100)));

  return (
    <div className="mt-3">
      <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 ${st.cls}`}>
        <Icon size={18} aria-hidden="true" className="shrink-0" />
        <div className="leading-tight">
          <span className="text-lg font-extrabold">{big}</span>{' '}
          <span className="text-xs font-medium opacity-80">{lbl}</span>
        </div>
      </div>
      {state !== 'none' && (
        <div className="mt-2 h-1.5 rounded-full bg-slate-200 dark:bg-white/10 overflow-hidden">
          <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: st.bar }} />
        </div>
      )}
    </div>
  );
}

export default function ImovelCmi({ imovelId, cmis, nowISO, acompanhamento, documentosCmi }: Props) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [form, setForm] = useState({
    tipo: 'exclusivo',
    data_cmi: new Date().toISOString().slice(0, 10),
    data_fim: '',
    comissao_pct: '',
    documento_id: '',
    notas: '',
  });

  async function verContrato(docId: string) {
    try {
      const res = await fetch(`/api/imoveis/${imovelId}/documentos/${docId}`);
      const json = await res.json();
      if (res.ok && json.url) window.open(json.url, '_blank', 'noopener');
      else setError(json.message ?? 'Erro a abrir o documento');
    } catch {
      setError('Erro a abrir o documento');
    }
  }

  function docLabel(docId: string | null): string | null {
    if (!docId) return null;
    return documentosCmi.find((d) => d.id === docId)?.filename ?? 'Contrato CMI';
  }

  async function addCmi(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(`/api/imoveis/${imovelId}/cmi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Erro');
      setForm({ ...form, data_fim: '', comissao_pct: '', documento_id: '', notas: '' });
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro');
    } finally {
      setAdding(false);
    }
  }

  async function setActivo(cmiId: string, activo: boolean) {
    await fetch(`/api/imoveis/${imovelId}/cmi/${cmiId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ activo }),
    });
    startTransition(() => router.refresh());
  }

  async function removeCmi(cmiId: string) {
    if (!confirm('Apagar CMI?')) return;
    await fetch(`/api/imoveis/${imovelId}/cmi/${cmiId}`, { method: 'DELETE' });
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      {cmis.length === 0 ? (
        <p className="text-sm text-slate-500 dark:text-slate-400">Sem CMI registado.</p>
      ) : (
        <ul className="space-y-2">
          {cmis.map((c) => (
            <li key={c.id} className={`rounded-md border p-3 ${c.activo ? 'border-green-400 ring-1 ring-green-300/60 dark:border-green-500/50 dark:ring-green-500/30' : 'border-slate-200 dark:border-white/10'}`}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded-full bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300 px-2 py-0.5 text-xs font-medium capitalize">{c.tipo}</span>
                    {c.activo && <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-300 px-2 py-0.5 text-xs font-medium">Activo</span>}
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-200 mt-1">
                    Data do CMI: {fmtDate(c.data_cmi)}
                    {c.data_fim && ` · Validade: ${fmtDate(c.data_fim)}`}
                  </p>
                  {c.comissao_pct != null && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Comissão {c.comissao_pct}%</p>}
                  {c.documento_id && (
                    <button type="button" onClick={() => verContrato(c.documento_id!)}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
                      📄 Ver contrato{docLabel(c.documento_id) ? ` · ${docLabel(c.documento_id)}` : ''}
                    </button>
                  )}
                  {c.notas && <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">{c.notas}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {!c.activo && (
                    <button type="button" onClick={() => setActivo(c.id, true)}
                      className="rounded border border-slate-300 dark:border-white/15 px-2 py-1 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5">Tornar activo</button>
                  )}
                  <button type="button" onClick={() => removeCmi(c.id)} className="text-red-600 hover:text-red-700 text-xs">Remover</button>
                </div>
              </div>
              <Countdown dataFim={c.data_fim} nowISO={nowISO} />
              {c.activo && <Acompanhamento a={acompanhamento} />}
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addCmi} className="rounded-md border border-slate-200 dark:border-white/10 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">Adicionar CMI</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Tipo">
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={inputCls}>
              {CMI_TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
          </Field>
          <Field label="Data do CMI">
            <input type="date" value={form.data_cmi} onChange={(e) => setForm({ ...form, data_cmi: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Validade (opcional)">
            <input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} className={inputCls} />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Comissão (%)">
            <input type="number" step="0.1" value={form.comissao_pct} onChange={(e) => setForm({ ...form, comissao_pct: e.target.value })} className={inputCls} />
          </Field>
          <Field label="Documento do CMI (opcional)">
            <select value={form.documento_id} onChange={(e) => setForm({ ...form, documento_id: e.target.value })} className={inputCls}>
              <option value="">{documentosCmi.length === 0 ? 'Sem documentos CMI carregados' : '— Ligar contrato —'}</option>
              {documentosCmi.map((d) => <option key={d.id} value={d.id}>{d.filename}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notas">
          <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })} rows={2} className={inputCls} />
        </Field>
        {error && <div className="rounded-md bg-red-50 text-red-700 p-2 text-xs">{error}</div>}
        <button type="submit" disabled={adding}
          className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
          {adding ? 'A criar…' : '+ CMI'}
        </button>
      </form>
    </div>
  );
}

const inputCls = 'w-full rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 text-slate-900 dark:text-slate-100 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1">{label}</span>
      {children}
    </label>
  );
}
