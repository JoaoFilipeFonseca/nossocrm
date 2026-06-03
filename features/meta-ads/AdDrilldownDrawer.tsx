'use client';

/**
 * MA-DRILLDOWN — drawer com tudo sobre UM anúncio: criativo + copy, métricas
 * vitalícias, e a lista de leads e negócios atribuídos a este anúncio.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { X, Image as ImageIcon, PlayCircle, Pencil, AlertTriangle } from 'lucide-react';

// CTAs mais comuns (imobiliário/leads). Valor = enum da Meta; label PT-PT.
const CTA_OPTIONS: { value: string; label: string }[] = [
  { value: 'LEARN_MORE', label: 'Saber mais' },
  { value: 'MESSAGE_PAGE', label: 'Enviar mensagem' },
  { value: 'CONTACT_US', label: 'Contactar' },
  { value: 'CALL_NOW', label: 'Ligar agora' },
  { value: 'SIGN_UP', label: 'Inscrever-se' },
  { value: 'GET_QUOTE', label: 'Pedir orçamento' },
  { value: 'SUBSCRIBE', label: 'Subscrever' },
  { value: 'APPLY_NOW', label: 'Candidatar-se' },
  { value: 'BOOK_TRAVEL', label: 'Reservar' },
  { value: 'DOWNLOAD', label: 'Transferir' },
];
const MAX_TITLE = 255;
const MAX_BODY = 2000;

interface Drilldown {
  ok?: boolean;
  ad: { ad_id: string; ad_name: string | null; adset_name: string | null; campaign_name: string | null };
  creative: { thumbnail_url: string | null; image_url: string | null; creative_type: string | null; permalink: string | null; title: string | null; body: string | null; cta_type: string | null };
  metrics: { spend_cents: number; impressions: number; clicks: number; meta_leads: number; crm_leads: number; cpl_cents: number | null; won_count: number; efectivo_cents: number; cpa_cents: number | null; roas: number | null };
  leads: { id: string; name: string | null; phone: string | null; email: string | null; created_at: string }[];
  deals: { id: string; title: string; value_cents: number; estado: string; created_at: string }[];
}

const eur = (cents: number | null) =>
  cents == null ? '—' : new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(cents / 100);
const fmtDate = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
const estadoChip = (e: string) =>
  e === 'Ganho' ? 'text-emerald-700 bg-emerald-50' : e === 'Perdido' ? 'text-red-700 bg-red-50' : 'text-slate-600 bg-slate-100';

export function AdDrilldownDrawer({ adId, adNameFallback, onClose }: { adId: string; adNameFallback: string; onClose: () => void }) {
  const [data, setData] = useState<Drilldown | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Edição de texto (MA-EDIT Tier 1).
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/meta-ads/ad/${adId}/drilldown`, { cache: 'no-store' });
      const json = await res.json();
      if (json.error) { setError(json.error); return; }
      setData(json);
    } catch {
      setError('Não foi possível carregar os dados do anúncio.');
    } finally {
      setLoading(false);
    }
  }, [adId]);

  useEffect(() => { void load(); }, [load]);

  const cr = data?.creative;
  const m = data?.metrics;

  return (
    <div className="fixed inset-0 z-[9999] flex justify-end bg-black/50" onMouseDown={onClose} role="dialog" aria-modal="true" aria-label="Dados do anúncio">
      <div
        className="w-full max-w-xl h-full bg-white dark:bg-dark-card shadow-2xl overflow-y-auto"
        onMouseDown={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'env(safe-area-inset-bottom,0px)' }}
      >
        {/* Cabeçalho */}
        <div className="sticky top-0 z-10 bg-white/95 dark:bg-dark-card/95 backdrop-blur border-b border-slate-200 dark:border-white/10 px-5 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              {data?.ad.campaign_name || '—'} › {data?.ad.adset_name || '—'}
            </p>
            <h2 className="text-base font-bold text-slate-900 dark:text-white truncate">{data?.ad.ad_name || adNameFallback}</h2>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <p className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">A carregar...</p>
        ) : error ? (
          <p className="p-8 text-center text-sm text-red-600 dark:text-red-400">{error}</p>
        ) : data ? (
          <div className="p-5 space-y-5">
            {/* Criativo + copy */}
            {editing && cr ? (
              <EditCopyPanel
                adId={adId}
                adName={data.ad.ad_name || adNameFallback}
                initial={{ title: cr.title, body: cr.body, cta_type: cr.cta_type }}
                onCancel={() => setEditing(false)}
                onSaved={() => { setEditing(false); void load(); }}
              />
            ) : (
              <div className="flex gap-4">
                <div className="w-28 h-28 shrink-0 rounded-xl overflow-hidden bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                  {cr?.thumbnail_url || cr?.image_url ? (
                    <img src={(cr.image_url || cr.thumbnail_url) as string} alt={data.ad.ad_name || 'Criativo'} className="w-full h-full object-cover" />
                  ) : cr?.creative_type === 'video' ? (
                    <PlayCircle className="w-8 h-8 text-slate-400" />
                  ) : (
                    <ImageIcon className="w-8 h-8 text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {cr?.title && (<><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Título</p><p className="text-sm font-bold text-slate-900 dark:text-white">{cr.title}</p></>)}
                  {cr?.body && (<><p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mt-2">Texto</p><p className="text-sm text-slate-700 dark:text-slate-300 line-clamp-4">{cr.body}</p></>)}
                  {cr?.cta_type && (<span className="inline-block mt-2 text-[11px] font-bold bg-primary-600 text-white px-2.5 py-1 rounded-md">{cr.cta_type.replaceAll('_', ' ')}</span>)}
                  {!cr?.title && !cr?.body && <p className="text-xs text-slate-400">Sem copy disponível para este criativo.</p>}
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      onClick={() => setEditing(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-600 bg-primary-50 dark:bg-primary-600/10 border border-primary-200 dark:border-primary-600/30 px-3 py-1.5 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-600/20"
                    >
                      <Pencil className="w-3.5 h-3.5" /> Editar texto
                    </button>
                    {cr?.permalink && <a href={cr.permalink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 hover:underline">Ver na Meta ↗</a>}
                  </div>
                </div>
              </div>
            )}

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-2">
              <Metric label="Gasto" value={eur(m!.spend_cents)} />
              <Metric label="Leads" value={String(m!.crm_leads || m!.meta_leads)} hint={m!.crm_leads ? 'CRM' : 'Meta'} />
              <Metric label="CPL" value={eur(m!.cpl_cents)} />
              <Metric label="Negócios ganhos" value={String(m!.won_count)} />
              <Metric label="€ efectivo" value={eur(m!.efectivo_cents)} win />
              <Metric label="Retorno" value={m!.roas == null ? '—' : `${m!.roas.toFixed(1)}×`} win />
            </div>

            {/* Leads */}
            <Section title="Leads deste anúncio" count={data.leads.length}>
              {data.leads.length === 0 ? (
                <Empty text="Ainda sem leads atribuídas a este anúncio. Enche quando entrarem leads via Meta." />
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {data.leads.map((l) => (
                    <div key={l.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white truncate">{l.name || 'Sem nome'}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{l.phone || l.email || '—'}</p>
                      </div>
                      <span className="text-xs text-slate-400">{fmtDate(l.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* Negócios */}
            <Section title="Negócios deste anúncio" count={data.deals.length}>
              {data.deals.length === 0 ? (
                <Empty text="Ainda sem negócios atribuídos a este anúncio." />
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-white/5">
                  {data.deals.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 py-2.5 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white truncate">{d.title}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{fmtDate(d.created_at)}</p>
                      </div>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${estadoChip(d.estado)}`}>{d.estado}</span>
                      <span className="text-sm font-bold text-slate-900 dark:text-white w-20 text-right">{d.value_cents ? eur(d.value_cents) : '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Metric({ label, value, hint, win }: { label: string; value: string; hint?: string; win?: boolean }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-white/10 p-2.5">
      <div className="text-[11px] text-slate-500 dark:text-slate-400">{label}{hint ? ` (${hint})` : ''}</div>
      <div className={`text-base font-bold mt-0.5 ${win ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>{value}</div>
    </div>
  );
}
function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4">
      <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-2">{title} <span className="text-slate-400 font-normal">({count})</span></h3>
      {children}
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <p className="py-3 text-center text-xs text-slate-500 dark:text-slate-400">{text}</p>;
}

// MA-EDIT Tier 1 — editar o texto do anúncio. Cria um criativo novo na Meta e
// aponta o anúncio a ele (a copy actual fica preservada no histórico da Meta).
function EditCopyPanel({
  adId, adName, initial, onCancel, onSaved,
}: {
  adId: string;
  adName: string;
  initial: { title: string | null; body: string | null; cta_type: string | null };
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(initial.title ?? '');
  const [body, setBody] = useState(initial.body ?? '');
  const [cta, setCta] = useState(initial.cta_type ?? '');
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Se o CTA actual não estiver na lista curada, junta-o para não se perder.
  const ctaOptions = cta && !CTA_OPTIONS.some((o) => o.value === cta)
    ? [{ value: cta, label: cta.replaceAll('_', ' ') }, ...CTA_OPTIONS]
    : CTA_OPTIONS;

  const dirty = title !== (initial.title ?? '') || body !== (initial.body ?? '') || cta !== (initial.cta_type ?? '');
  const canSave = (title.trim().length > 0 || body.trim().length > 0) && dirty;

  const save = useCallback(async () => {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/meta-ads/edit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_copy',
          ad_id: adId,
          title: title.trim() || null,
          body: body.trim() || null,
          cta_type: cta || null,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) { setErr(json.error || 'Não foi possível gravar.'); setConfirm(false); return; }
      onSaved();
    } catch {
      setErr('Não foi possível gravar. Tente de novo.');
      setConfirm(false);
    } finally {
      setSaving(false);
    }
  }, [adId, title, body, cta, onSaved]);

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-white/10 p-4 space-y-3">
      <div>
        <label className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
          <span>Título</span>
          <span className="text-slate-400 font-semibold normal-case">{title.length} / {MAX_TITLE}</span>
        </label>
        <input
          value={title}
          maxLength={MAX_TITLE}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          placeholder="Título do anúncio"
        />
      </div>

      <div>
        <label className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">
          <span>Texto principal</span>
          <span className="text-slate-400 font-semibold normal-case">{body.length}</span>
        </label>
        <textarea
          value={body}
          maxLength={MAX_BODY}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 resize-y"
          placeholder="Texto principal do anúncio"
        />
      </div>

      <div>
        <label className="block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-1">Botão (CTA)</label>
        <select
          value={cta}
          onChange={(e) => setCta(e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Sem botão</option>
          {ctaOptions.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
        </select>
      </div>

      <div className="flex gap-2.5 rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <p>Guardar <b>cria um criativo novo na Meta</b> e o anúncio <b>volta a revisão</b> (reinicia a aprendizagem). Para testar sem arriscar um anúncio que já vende, vai poder <b>duplicar primeiro</b> (próximo tier).</p>
      </div>

      {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}

      {confirm ? (
        <div className="space-y-2">
          <div className="rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5 px-3 py-2.5 text-xs text-amber-800 dark:text-amber-300">
            Vais gravar texto novo no anúncio <b>{adName}</b> na Meta. Confirma?
          </div>
          <div className="flex gap-2">
            <button onClick={() => setConfirm(false)} disabled={saving} className="flex-1 rounded-lg bg-slate-100 dark:bg-white/5 px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 disabled:opacity-50">Voltar</button>
            <button onClick={() => void save()} disabled={saving} className="flex-1 rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-50">{saving ? 'A gravar...' : 'Confirmar e gravar'}</button>
          </div>
          <p className="text-center text-[11px] text-slate-400">Fica registado em audit_logs (antes/depois).</p>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg bg-slate-100 dark:bg-white/5 px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200">Cancelar</button>
          <button onClick={() => setConfirm(true)} disabled={!canSave} className="flex-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-bold text-white hover:bg-primary-700 disabled:opacity-40">Guardar na Meta</button>
        </div>
      )}
    </div>
  );
}
