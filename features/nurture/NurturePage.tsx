'use client';

// BRIEF 7 / 7b — Nurture: fila de aprovação de emails + revisão de segmentos.
// Vive como aba dentro de Mensagens (não incha a barra lateral). Nada sai sem a
// aprovação do João; a IA prepara, o João decide.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  MailCheck, Sparkles, Send, Check, X, Trash2, RefreshCw, Pencil, Users, Eye, MousePointerClick, Reply,
} from 'lucide-react';
import { useToast } from '@/context/ToastContext';
import { SEGMENTS, SEGMENT_LABELS, segmentLabel, type Segment } from '@/lib/nurture/segments';

type Status = 'pending' | 'approved' | 'rejected' | 'sent' | 'failed' | 'skipped';

interface QueueItem {
  id: string;
  contact_id: string;
  contact_name: string | null;
  segment: string;
  wave: string;
  step: number;
  to_email: string;
  subject: string;
  body_text: string;
  status: Status;
  generated_by: string;
  opened_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
  sent_at: string | null;
}

interface SegContact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  segment: string | null;
  segment_set_by: string | null;
  segment_rationale: string | null;
}

const STATUS_META: Record<Status, { label: string; cls: string }> = {
  pending: { label: 'Pendente', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300' },
  approved: { label: 'Aprovado', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300' },
  rejected: { label: 'Rejeitado', cls: 'bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-300' },
  sent: { label: 'Enviado', cls: 'bg-teal-100 text-teal-700 dark:bg-teal-500/15 dark:text-teal-300' },
  failed: { label: 'Falhou', cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300' },
  skipped: { label: 'Saltado', cls: 'bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-400' },
};

const SEG_BADGE = 'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300';

async function postJSON(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

// ===========================================================================
export function NurturePage() {
  const { addToast } = useToast();
  const [view, setView] = useState<'fila' | 'segmentos'>('fila');

  const subTabCls = (active: boolean) =>
    `flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
      active
        ? 'bg-primary-600 text-white'
        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
    }`;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-200 dark:border-white/10 shrink-0">
        <button type="button" className={subTabCls(view === 'fila')} onClick={() => setView('fila')}>
          <MailCheck className="w-4 h-4" /> Fila de aprovação
        </button>
        <button type="button" className={subTabCls(view === 'segmentos')} onClick={() => setView('segmentos')}>
          <Users className="w-4 h-4" /> Segmentos
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {view === 'fila' ? <QueueView addToast={addToast} /> : <SegmentsView addToast={addToast} />}
      </div>
    </div>
  );
}

// ===========================================================================
// FILA DE APROVAÇÃO
// ===========================================================================
function QueueView({ addToast }: { addToast: (m: string, t?: 'success' | 'error' | 'info' | 'warning') => void }) {
  const [status, setStatus] = useState<Status | 'todos'>('pending');
  const [items, setItems] = useState<QueueItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editSubject, setEditSubject] = useState('');
  const [editBody, setEditBody] = useState('');
  const [showGen, setShowGen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nurture/queue?status=${status}&limit=200`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro a carregar a fila');
      setItems((data.items ?? []) as QueueItem[]);
      setCounts((data.counts ?? {}) as Record<string, number>);
      setSelected(new Set());
    } catch (e) {
      addToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [status, addToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const active = useMemo(() => items.find((i) => i.id === activeId) || null, [items, activeId]);
  useEffect(() => {
    if (active) {
      setEditSubject(active.subject);
      setEditBody(active.body_text);
    }
  }, [active]);

  const approvedCount = counts.approved ?? 0;

  const act = async (action: 'approve' | 'reject' | 'delete', ids: string[]) => {
    if (ids.length === 0) return;
    if (action === 'delete' && !window.confirm(`Apagar ${ids.length} email(s) da fila?`)) return;
    setBusy(true);
    const { ok, data } = await postJSON('/api/nurture/queue/action', { action, ids });
    setBusy(false);
    if (!ok) return addToast((data.error as string) || 'Erro', 'error');
    addToast(`${action === 'approve' ? 'Aprovado(s)' : action === 'reject' ? 'Rejeitado(s)' : 'Apagado(s)'}: ${data.updated}`, 'success');
    await load();
  };

  const saveEdit = async () => {
    if (!active) return;
    setBusy(true);
    const { ok, data } = await postJSON('/api/nurture/queue/action', {
      action: 'edit',
      ids: [active.id],
      subject: editSubject,
      bodyText: editBody,
    });
    setBusy(false);
    if (!ok) return addToast((data.error as string) || 'Erro', 'error');
    addToast('Alterações guardadas', 'success');
    await load();
  };

  const sendApproved = async () => {
    if (!window.confirm(`Enviar ${approvedCount} email(s) aprovado(s) agora? Vão sair pela marca João Fonseca, com anular subscrição.`)) return;
    setBusy(true);
    const { ok, data } = await postJSON('/api/nurture/send', { manual_trigger: true });
    setBusy(false);
    if (!ok) return addToast((data.error as string) || 'Erro no envio', 'error');
    const results = (data.results ?? []) as Array<{ sent: number; skipped: number; failed: number }>;
    const sent = results.reduce((a, r) => a + r.sent, 0);
    const failed = results.reduce((a, r) => a + r.failed, 0);
    const skipped = results.reduce((a, r) => a + r.skipped, 0);
    if ((data.skipped as string) === 'sunday') addToast('Não se envia ao Domingo', 'warning');
    else addToast(`Enviados ${sent}${failed ? ` · ${failed} falharam` : ''}${skipped ? ` · ${skipped} saltados` : ''}`, sent > 0 ? 'success' : 'info');
    await load();
  };

  const toggleSel = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const STATUS_TABS: Array<Status | 'todos'> = ['pending', 'approved', 'sent', 'rejected', 'todos'];

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-slate-200 dark:border-white/10">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatus(s)}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold ${
                status === s
                  ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900'
                  : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'
              }`}
            >
              {s === 'todos' ? 'Todos' : STATUS_META[s as Status].label}
              <span className="ml-1 opacity-70">{counts[s === 'todos' ? 'todos' : s] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <button type="button" onClick={() => setShowGen((v) => !v)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-200">
          <Sparkles className="w-4 h-4" /> Gerar onda
        </button>
        <button
          type="button"
          onClick={sendApproved}
          disabled={busy || approvedCount === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40"
        >
          <Send className="w-4 h-4" /> Enviar aprovados ({approvedCount})
        </button>
        <button type="button" onClick={() => load()} className="p-2 rounded-md hover:bg-slate-100 dark:hover:bg-white/10" title="Actualizar">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {showGen && <GeneratePanel addToast={addToast} onDone={() => { setShowGen(false); void load(); }} />}

      {/* Batch bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-sm">
          <span className="font-semibold">{selected.size} selecionado(s)</span>
          <button type="button" onClick={() => act('approve', [...selected])} disabled={busy} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-600 text-white text-xs"><Check className="w-3.5 h-3.5" /> Aprovar</button>
          <button type="button" onClick={() => act('reject', [...selected])} disabled={busy} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-500 text-white text-xs"><X className="w-3.5 h-3.5" /> Rejeitar</button>
          <button type="button" onClick={() => act('delete', [...selected])} disabled={busy} className="inline-flex items-center gap-1 px-2 py-1 rounded bg-red-600 text-white text-xs"><Trash2 className="w-3.5 h-3.5" /> Apagar</button>
        </div>
      )}

      {/* Lista + preview */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-0">
        <div className="overflow-auto border-r border-slate-200 dark:border-white/10">
          {loading ? (
            <div className="p-6 text-sm text-slate-500">A carregar…</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Sem emails neste estado. Use "Gerar onda" para criar rascunhos.</div>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-white/5">
              {items.map((it) => (
                <li
                  key={it.id}
                  className={`flex items-start gap-2 p-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 ${activeId === it.id ? 'bg-primary-50 dark:bg-primary-500/10' : ''}`}
                  onClick={() => setActiveId(it.id)}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(it.id)}
                    onChange={(e) => { e.stopPropagation(); toggleSel(it.id); }}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">{it.contact_name || it.to_email}</span>
                      <span className={SEG_BADGE}>{segmentLabel(it.segment)}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_META[it.status].cls}`}>{STATUS_META[it.status].label}</span>
                      {it.opened_at && <Eye className="w-3.5 h-3.5 text-teal-500" aria-label="Abriu" />}
                      {it.clicked_at && <MousePointerClick className="w-3.5 h-3.5 text-teal-600" aria-label="Clicou" />}
                      {it.replied_at && <Reply className="w-3.5 h-3.5 text-emerald-600" aria-label="Respondeu" />}
                    </div>
                    <div className="text-sm text-slate-600 dark:text-slate-300 truncate">{it.subject}</div>
                    <div className="text-[11px] text-slate-400">{it.to_email} · {it.generated_by === 'ai' ? 'IA' : 'modelo'}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Preview / edição */}
        <div className="overflow-auto p-4 hidden lg:block">
          {!active ? (
            <div className="text-sm text-slate-400">Escolha um email para pré-visualizar e editar.</div>
          ) : (
            <div className="max-w-xl">
              <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1">Para: {active.contact_name || ''} · {active.to_email}</div>
              <input
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                disabled={active.status === 'sent'}
                className="w-full mb-3 px-3 py-2 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm font-semibold"
                placeholder="Assunto"
              />
              <textarea
                value={editBody}
                onChange={(e) => setEditBody(e.target.value)}
                disabled={active.status === 'sent'}
                rows={14}
                className="w-full px-3 py-2 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm leading-relaxed whitespace-pre-wrap"
              />
              <p className="text-[11px] text-slate-400 mt-1">O rodapé de anular subscrição e a política de privacidade são acrescentados no envio.</p>
              {active.status !== 'sent' && (
                <div className="flex flex-wrap gap-2 mt-3">
                  <button type="button" onClick={saveEdit} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-slate-800 text-white dark:bg-white dark:text-slate-900"><Pencil className="w-4 h-4" /> Guardar</button>
                  <button type="button" onClick={() => act('approve', [active.id])} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-emerald-600 text-white"><Check className="w-4 h-4" /> Aprovar</button>
                  <button type="button" onClick={() => act('reject', [active.id])} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-slate-500 text-white"><X className="w-4 h-4" /> Rejeitar</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// GERAR ONDA
// ===========================================================================
function GeneratePanel({ addToast, onDone }: { addToast: (m: string, t?: 'success' | 'error' | 'info' | 'warning') => void; onDone: () => void }) {
  const [segment, setSegment] = useState<Segment | 'todos'>('todos');
  const [limit, setLimit] = useState(20);
  const [ids, setIds] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    const body: Record<string, unknown> = { wave: 'reactivacao-2026-q3', step: 1, limit };
    const idList = ids.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
    if (idList.length > 0) body.contactIds = idList;
    else if (segment !== 'todos') body.segment = segment;
    const { ok, data } = await postJSON('/api/nurture/generate', body);
    setBusy(false);
    if (!ok) return addToast((data.error as string) || 'Erro a gerar', 'error');
    addToast(`Gerados ${data.generated} rascunho(s)`, 'success');
    onDone();
  };

  return (
    <div className="p-3 bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 flex flex-wrap items-end gap-3 text-sm">
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500">Segmento</span>
        <select value={segment} onChange={(e) => setSegment(e.target.value as Segment | 'todos')} className="px-2 py-1.5 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900">
          <option value="todos">Todos os segmentos</option>
          {SEGMENTS.map((s) => <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500">Quantos (piloto)</span>
        <input type="number" min={1} max={200} value={limit} onChange={(e) => setLimit(Number(e.target.value))} className="w-24 px-2 py-1.5 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900" />
      </label>
      <label className="flex flex-col gap-1 flex-1 min-w-[200px]">
        <span className="text-xs text-slate-500">Ou IDs de contactos (piloto escolhido), separados por vírgula</span>
        <input value={ids} onChange={(e) => setIds(e.target.value)} placeholder="opcional" className="px-2 py-1.5 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900" />
      </label>
      <button type="button" onClick={run} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-semibold bg-primary-600 text-white disabled:opacity-40">
        <Sparkles className="w-4 h-4" /> {busy ? 'A gerar…' : 'Gerar rascunhos'}
      </button>
    </div>
  );
}

// ===========================================================================
// SEGMENTOS
// ===========================================================================
function SegmentsView({ addToast }: { addToast: (m: string, t?: 'success' | 'error' | 'info' | 'warning') => void }) {
  const [filter, setFilter] = useState<string>('todos');
  const [search, setSearch] = useState('');
  const [contacts, setContacts] = useState<SegContact[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/nurture/segments?segment=${filter}&search=${encodeURIComponent(search)}&limit=100`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Erro a carregar');
      setContacts((data.contacts ?? []) as SegContact[]);
      setCounts((data.counts ?? {}) as Record<string, number>);
    } catch (e) {
      addToast((e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [filter, search, addToast]);

  useEffect(() => {
    const t = setTimeout(() => { void load(); }, 250);
    return () => clearTimeout(t);
  }, [load]);

  const runSegment = async (ai: boolean) => {
    setBusy(true);
    const { ok, data } = await postJSON('/api/nurture/segment/run', { onlyUnset: true, ai, aiLimit: ai ? 60 : 0 });
    setBusy(false);
    if (!ok) return addToast((data.error as string) || 'Erro', 'error');
    addToast(`Base segmentada${ai ? ` · ${data.refined} refinados pela IA` : ''}`, 'success');
    await load();
  };

  const setSegment = async (contactId: string, segment: string) => {
    const { ok, data } = await postJSON('/api/nurture/segments', { contactId, segment });
    if (!ok) return addToast((data.error as string) || 'Erro', 'error');
    setContacts((prev) => prev.map((c) => (c.id === contactId ? { ...c, segment, segment_set_by: 'human', segment_rationale: 'Corrigido manualmente pelo João.' } : c)));
    addToast('Segmento corrigido', 'success');
  };

  const TABS: Array<{ key: string; label: string }> = [
    { key: 'todos', label: 'Todos' },
    ...SEGMENTS.map((s) => ({ key: s, label: SEGMENT_LABELS[s] })),
    { key: 'por_classificar', label: 'Por classificar' },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-wrap items-center gap-2 p-3 border-b border-slate-200 dark:border-white/10">
        <div className="flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button key={t.key} type="button" onClick={() => setFilter(t.key)} className={`px-2.5 py-1 rounded-md text-xs font-semibold ${filter === t.key ? 'bg-slate-800 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
              {t.label}<span className="ml-1 opacity-70">{counts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Procurar nome/email" className="px-2 py-1.5 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-sm" />
        <button type="button" onClick={() => runSegment(false)} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-200"><RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} /> Segmentar base</button>
        <button type="button" onClick={() => runSegment(true)} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold bg-primary-600 text-white"><Sparkles className="w-4 h-4" /> Refinar com IA</button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 text-sm text-slate-500">A carregar…</div>
        ) : contacts.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">Sem contactos.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-400 sticky top-0 bg-white dark:bg-slate-900">
              <tr>
                <th className="p-2 font-medium">Contacto</th>
                <th className="p-2 font-medium hidden sm:table-cell">Origem</th>
                <th className="p-2 font-medium">Segmento</th>
                <th className="p-2 font-medium hidden md:table-cell">Porquê</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {contacts.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-white/5">
                  <td className="p-2">
                    <div className="font-medium truncate max-w-[180px]">{c.name || '(sem nome)'}</div>
                    <div className="text-[11px] text-slate-400 truncate max-w-[180px]">{c.email || c.phone || ''}</div>
                  </td>
                  <td className="p-2 hidden sm:table-cell text-slate-500 truncate max-w-[140px]">{c.source || '—'}</td>
                  <td className="p-2">
                    <select
                      value={c.segment || ''}
                      onChange={(e) => setSegment(c.id, e.target.value)}
                      className="px-2 py-1 rounded-md border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-xs"
                    >
                      <option value="" disabled>Por classificar</option>
                      {SEGMENTS.map((s) => <option key={s} value={s}>{SEGMENT_LABELS[s]}</option>)}
                    </select>
                    {c.segment_set_by === 'human' && <span className="ml-1 text-[10px] text-emerald-600">✓ manual</span>}
                  </td>
                  <td className="p-2 hidden md:table-cell text-[11px] text-slate-400 max-w-[260px]">{c.segment_rationale || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default NurturePage;
