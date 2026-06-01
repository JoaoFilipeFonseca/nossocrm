'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Pencil, Check, X, Plus, Trash2, Search } from 'lucide-react';
import { contactsService } from '@/lib/supabase/contacts';
import type { ContactCustomFields, DiscProfile } from '@/types';

export interface ReferralLinkDTO {
  referralId: string;
  contactId: string;
  name: string;
  note: string | null;
}

interface ContactRichPanelProps {
  contactId: string;
  initialCustomFields: ContactCustomFields;
  initialNotes: string;
  initialBirthDate?: string;
  initialReferredBy: ReferralLinkDTO[];
  initialReferred: ReferralLinkDTO[];
}

const DISC_OPTIONS: { value: DiscProfile; label: string }[] = [
  { value: 'D', label: 'D — Dominante' },
  { value: 'I', label: 'I — Influente' },
  { value: 'S', label: 'S — Estável' },
  { value: 'C', label: 'C — Consciencioso' },
];

const DISC_DOT: Record<DiscProfile, string> = {
  D: 'bg-rose-500', I: 'bg-amber-500', S: 'bg-emerald-500', C: 'bg-blue-500',
};

function formatPtDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Lisbon' });
}

const inputCls =
  'w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500';
const labelCls = 'block text-xs font-bold text-slate-500 uppercase mb-1';

export function ContactRichPanel({
  contactId,
  initialCustomFields,
  initialNotes,
  initialBirthDate,
  initialReferredBy,
  initialReferred,
}: ContactRichPanelProps) {
  const router = useRouter();
  const [editing, setEditing] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Estado editável
  const [cf, setCf] = React.useState<ContactCustomFields>(initialCustomFields);
  const [notes, setNotes] = React.useState(initialNotes);
  const [birthDate, setBirthDate] = React.useState(initialBirthDate ?? '');
  const [triggersText, setTriggersText] = React.useState((initialCustomFields.triggers ?? []).join(', '));

  // Re-sincroniza com o servidor (após router.refresh, ex.: sugestão do 360-AI
  // aceite) quando NÃO está em edição — sem clobber das edições em curso.
  const initialSig = JSON.stringify({ initialCustomFields, initialNotes, initialBirthDate });
  React.useEffect(() => {
    if (editing) return;
    setCf(initialCustomFields);
    setNotes(initialNotes);
    setBirthDate(initialBirthDate ?? '');
    setTriggersText((initialCustomFields.triggers ?? []).join(', '));
  }, [initialSig]);

  const setField = <K extends keyof ContactCustomFields>(k: K, v: ContactCustomFields[K]) =>
    setCf((prev) => ({ ...prev, [k]: v }));

  const resetFromInitial = () => {
    setCf(initialCustomFields);
    setNotes(initialNotes);
    setBirthDate(initialBirthDate ?? '');
    setTriggersText((initialCustomFields.triggers ?? []).join(', '));
    setError(null);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const triggers = triggersText.split(',').map((t) => t.trim()).filter(Boolean);
    const savedFields: ContactCustomFields = { ...cf, triggers };
    const payload = {
      customFields: savedFields,
      notes: notes || null,
      birthDate: birthDate || null,
    };
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Falha ao guardar.');
      }
      // Sincroniza o estado local com o que foi gravado (a vista de leitura é
      // alimentada por este estado, não pelas props do servidor — que não
      // re-semeiam o useState após router.refresh).
      setCf(savedFields);
      setTriggersText(triggers.join(', '));
      setEditing(false);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar.');
    } finally {
      setSaving(false);
    }
  };

  // Linhas read-only
  const triggers = cf.triggers ?? [];
  const birthLabel = formatPtDate(birthDate);
  const lastActivity = formatPtDate(cf.lastActivityDate);
  const followUpLabel = formatPtDate(cf.followUpDate);

  const readRows: { icon: string; label: string; node: React.ReactNode }[] = [];
  if (cf.address) readRows.push({ icon: '📍', label: 'Morada / Investimento', node: cf.address });
  if (cf.familyMembers) readRows.push({ icon: '👨‍👩‍👧', label: 'Família', node: cf.familyMembers });
  if (cf.pets) readRows.push({ icon: '🐾', label: 'Animais', node: cf.pets });
  if (triggers.length > 0) {
    readRows.push({
      icon: '⚡', label: 'Triggers',
      node: (
        <div className="flex flex-wrap gap-1.5">
          {triggers.map((t, i) => (
            <span key={i} className="px-2 py-0.5 rounded-md text-xs bg-rose-50 text-rose-700 border border-rose-200">{t}</span>
          ))}
        </div>
      ),
    });
  }
  if (cf.disc) {
    const opt = DISC_OPTIONS.find((o) => o.value === cf.disc);
    readRows.push({ icon: '🎨', label: 'DISC', node: (
      <span className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${DISC_DOT[cf.disc]}`} /> {opt?.label ?? cf.disc}</span>
    ) });
  }
  if (birthLabel) readRows.push({ icon: '🎂', label: 'Aniversário', node: birthLabel });
  if (cf.quarter) readRows.push({ icon: '🗓️', label: 'Trimestre', node: cf.quarter });
  if (lastActivity) readRows.push({ icon: '⏱️', label: 'Última actividade', node: cf.lastActivityNote ? `${lastActivity} · ${cf.lastActivityNote}` : lastActivity });
  if (cf.followUp) readRows.push({ icon: '🔔', label: 'Follow Up?', node: <span className="text-emerald-700 dark:text-emerald-400 font-medium">Sim{followUpLabel ? ` · próximo a ${followUpLabel}` : ''}</span> });

  return (
    <>
      <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">Sobre a pessoa</h2>
          {!editing ? (
            <button onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 text-xs text-primary-600 font-semibold hover:underline">
              <Pencil size={13} /> Editar campos
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <button onClick={() => { resetFromInitial(); setEditing(false); }} disabled={saving} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700">
                <X size={14} /> Cancelar
              </button>
              <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-500 disabled:opacity-60">
                <Check size={14} /> {saving ? 'A guardar...' : 'Guardar'}
              </button>
            </div>
          )}
        </div>

        {error && <p className="px-5 pb-2 text-xs text-rose-600">{error}</p>}

        {!editing ? (
          readRows.length > 0 ? (
            <div className="divide-y divide-slate-100 dark:divide-white/5">
              {readRows.map((row) => (
                <div key={row.label} className="px-5 py-2.5 flex items-start gap-3 sm:gap-4">
                  <div className="w-40 shrink-0 text-xs font-medium text-slate-500 flex items-center gap-2 pt-0.5"><span aria-hidden>{row.icon}</span> {row.label}</div>
                  <div className="flex-1 text-sm text-slate-800 dark:text-slate-200">{row.node}</div>
                </div>
              ))}
            </div>
          ) : (
            <p className="px-5 pb-4 text-sm text-slate-500">Sem campos preenchidos ainda. Carregue em “Editar campos”.</p>
          )
        ) : (
          <div className="px-5 pb-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Morada / Investimento</label>
              <input className={inputCls} value={cf.address ?? ''} onChange={(e) => setField('address', e.target.value)} placeholder="Ex.: Rua X, procura T3 até 220.000€" />
            </div>
            <div>
              <label className={labelCls}>Família</label>
              <input className={inputCls} value={cf.familyMembers ?? ''} onChange={(e) => setField('familyMembers', e.target.value)} placeholder="Ex.: Casada, 2 filhos" />
            </div>
            <div>
              <label className={labelCls}>Animais</label>
              <input className={inputCls} value={cf.pets ?? ''} onChange={(e) => setField('pets', e.target.value)} placeholder="Ex.: 1 cão" />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Triggers (separados por vírgula)</label>
              <input className={inputCls} value={triggersText} onChange={(e) => setTriggersText(e.target.value)} placeholder="Mudança de casa, Crédito aprovado" />
            </div>
            <div>
              <label className={labelCls}>DISC</label>
              <select className={inputCls} value={cf.disc ?? ''} onChange={(e) => setField('disc', (e.target.value || null) as DiscProfile | null)}>
                <option value="">—</option>
                {DISC_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Trimestre</label>
              <input className={inputCls} value={cf.quarter ?? ''} onChange={(e) => setField('quarter', e.target.value)} placeholder="Q3 2026" />
            </div>
            <div>
              <label className={labelCls}>Aniversário</label>
              <input type="date" className={inputCls} value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Última actividade (data)</label>
              <input type="date" className={inputCls} value={cf.lastActivityDate ?? ''} onChange={(e) => setField('lastActivityDate', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Nota da última actividade</label>
              <input className={inputCls} value={cf.lastActivityNote ?? ''} onChange={(e) => setField('lastActivityNote', e.target.value)} placeholder="Ex.: Visita ao T3 em Seroa" />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input id="cf-followup" type="checkbox" checked={cf.followUp ?? false} onChange={(e) => setField('followUp', e.target.checked)} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
              <label htmlFor="cf-followup" className="text-sm text-slate-700 dark:text-slate-300">Precisa de acompanhamento (Follow Up)</label>
            </div>
            <div>
              <label className={labelCls}>Próximo follow up</label>
              <input type="date" className={inputCls} value={cf.followUpDate ?? ''} onChange={(e) => setField('followUpDate', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Notas</label>
              <textarea className={`${inputCls} min-h-[90px]`} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas gerais sobre a pessoa..." />
            </div>
          </div>
        )}

        {/* Relações */}
        <ReferralsEditor
          contactId={contactId}
          referredBy={initialReferredBy}
          referred={initialReferred}
          onChanged={() => router.refresh()}
        />
      </div>

      {/* Notas (read) */}
      {!editing && notes && (
        <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm p-5">
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">Notas</h2>
          <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">{notes}</p>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function ReferralsEditor({
  contactId, referredBy, referred, onChanged,
}: {
  contactId: string;
  referredBy: ReferralLinkDTO[];
  referred: ReferralLinkDTO[];
  onChanged: () => void;
}) {
  const [adding, setAdding] = React.useState<null | 'referredBy' | 'referred'>(null);
  const [busy, setBusy] = React.useState(false);

  const removeReferral = async (referralId: string) => {
    setBusy(true);
    try {
      await fetch(`/api/contacts/${contactId}/referrals?referralId=${referralId}`, { method: 'DELETE' });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const addReferral = async (direction: 'referredBy' | 'referred', otherContactId: string) => {
    setBusy(true);
    try {
      await fetch(`/api/contacts/${contactId}/referrals`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ direction, otherContactId }),
      });
      setAdding(null);
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  const renderRow = (label: string, icon: string, dir: 'referredBy' | 'referred', items: ReferralLinkDTO[]) => (
    <div className="px-5 py-2.5 flex items-start gap-3 sm:gap-4">
      <div className="w-40 shrink-0 text-xs font-medium text-slate-500 flex items-center gap-2 pt-0.5"><span aria-hidden>{icon}</span> {label}</div>
      <div className="flex-1 flex flex-wrap items-center gap-1.5">
        {items.map((r) => (
          <span key={r.referralId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 text-xs font-medium">
            <Link href={`/contacts/${r.contactId}`} className="hover:underline">{r.name}</Link>
            <button onClick={() => removeReferral(r.referralId)} disabled={busy} aria-label={`Remover ${r.name}`} className="text-slate-400 hover:text-rose-500">
              <X size={12} />
            </button>
          </span>
        ))}
        {adding === dir ? (
          <ContactPicker excludeId={contactId} onPick={(id) => addReferral(dir, id)} onCancel={() => setAdding(null)} />
        ) : (
          <button onClick={() => setAdding(dir)} disabled={busy} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-dashed border-slate-300 dark:border-white/15 text-slate-500 hover:text-primary-600 hover:border-primary-400 text-xs">
            <Plus size={12} /> Adicionar
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="border-t border-slate-100 dark:border-white/5 divide-y divide-slate-100 dark:divide-white/5">
      {renderRow('Indicado por', '🤝', 'referredBy', referredBy)}
      {renderRow('Indicou', '↪️', 'referred', referred)}
    </div>
  );
}

// ---------------------------------------------------------------------------

function ContactPicker({ excludeId, onPick, onCancel }: { excludeId: string; onPick: (id: string) => void; onCancel: () => void }) {
  const [term, setTerm] = React.useState('');
  const [results, setResults] = React.useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (term.trim().length < 2) { setResults([]); return; }
    let cancelled = false;
    setLoading(true);
    const handle = setTimeout(async () => {
      const { data } = await contactsService.getAllPaginated({ pageIndex: 0, pageSize: 8 }, { search: term.trim() });
      if (cancelled) return;
      setResults((data?.data ?? []).filter((c) => c.id !== excludeId).map((c) => ({ id: c.id, name: c.name })));
      setLoading(false);
    }, 250);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [term, excludeId]);

  return (
    <div className="relative inline-block">
      <div className="inline-flex items-center gap-1 rounded-md border border-slate-300 dark:border-white/15 bg-white dark:bg-dark-card px-2 py-1">
        <Search size={12} className="text-slate-400" />
        <input
          autoFocus
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Procurar contacto..."
          className="text-xs bg-transparent outline-none w-40 text-slate-800 dark:text-white"
        />
        <button onClick={onCancel} aria-label="Cancelar" className="text-slate-400 hover:text-slate-600"><X size={12} /></button>
      </div>
      {(results.length > 0 || loading) && (
        <ul className="absolute z-10 mt-1 w-56 max-h-60 overflow-y-auto rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card shadow-lg">
          {loading && <li className="px-3 py-2 text-xs text-slate-400">A procurar...</li>}
          {results.map((r) => (
            <li key={r.id}>
              <button onClick={() => onPick(r.id)} className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5">{r.name}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
