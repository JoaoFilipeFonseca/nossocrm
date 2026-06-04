'use client';

/**
 * MA-CREATE (Tier 4) — construtor de anúncios no CRM. Wizard por fases.
 * PASSO 1 (Campanha): objectivo (Leads/Tráfego/Interação) + nome + defaults
 *   travados do João; cria a campanha EM PAUSA na Meta (audit) e avança.
 * PASSO 2 (Conjunto): onde converter (Formulário/Site/WhatsApp) + orçamento
 *   diário (mínimo da conta) + localização (pesquisa Meta) + raio + público
 *   estimado + Advantage+; cria o conjunto EM PAUSA, encadeado ao campaign_id.
 * PASSO 3 (Anúncio): imagem (upload à Meta) + título + texto + descrição +
 *   destino (Formulário existente ou Site URL) + CTA; cria o criativo e o
 *   anúncio EM PAUSA, encadeado ao adset_id. A Fase 4 (criar formulário + CAPI)
 *   acrescenta-se a este shell.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  X, Target, MousePointerClick, MessageCircle, AlertTriangle, Check,
  FileText, Globe, MapPin, Sparkles, ArrowLeft, Loader2, Image as ImageIcon, Upload,
} from 'lucide-react';

type Objective = 'leads' | 'trafego' | 'interacao';
type Conversion = 'form' | 'site' | 'whatsapp';
type Step = 1 | 2 | 3 | 'done';

// Apelos à acção (enum da Meta → etiqueta PT).
const CTA_OPTIONS: { value: string; label: string }[] = [
  { value: 'LEARN_MORE', label: 'Saber mais' },
  { value: 'SIGN_UP', label: 'Inscrever-se' },
  { value: 'GET_QUOTE', label: 'Pedir orçamento' },
  { value: 'CONTACT_US', label: 'Contactar' },
  { value: 'SUBSCRIBE', label: 'Subscrever' },
  { value: 'DOWNLOAD', label: 'Transferir' },
];

interface LeadForm { id: string; name: string; status: string }

const OBJECTIVES: { key: Objective; label: string; icon: typeof Target; hint: string }[] = [
  { key: 'leads', label: 'Leads', icon: Target, hint: 'Recolher contactos (formulário ou site).' },
  { key: 'trafego', label: 'Tráfego', icon: MousePointerClick, hint: 'Levar pessoas a um site ou página.' },
  { key: 'interacao', label: 'Interação', icon: MessageCircle, hint: 'Mensagens, comentários e interesse.' },
];

const CONVERSIONS: { key: Conversion; label: string; icon: typeof FileText; hint: string }[] = [
  { key: 'form', label: 'Formulário', icon: FileText, hint: 'Formulário instantâneo na Meta (recomendado).' },
  { key: 'site', label: 'Site', icon: Globe, hint: 'Visitas a uma página do teu site.' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, hint: 'Conversas por mensagem.' },
];

const RADIUS_OPTIONS = [10, 17, 25, 40];

// Defaults travados (decisão do João) — mostrados como chips informativos.
const LOCKED = ['🏠 Imobiliário', '🇵🇹 Portugal', '💶 Orçamento no conjunto', '🚫 Sem partilha de 20%', '🛒 Leilão'];

// Mínimo diário desta conta (~2,59€). A Meta é a autoridade final.
const MIN_DAILY_CENTS = 259;

/** Converte "5,00" / "5" (euros) em cêntimos; null se inválido. */
function parseEurosToCents(input: string): number | null {
  const cleaned = (input ?? '').replace(/[€\s]/g, '').replace(',', '.');
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const euros = parseFloat(cleaned);
  if (!Number.isFinite(euros) || euros <= 0) return null;
  return Math.round(euros * 100);
}

const fmtInt = (n: number) => n.toLocaleString('pt-PT');

interface GeoResult { key: string; name: string; type: string; region?: string; countryName?: string }

export function CreateAdWizard({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [step, setStep] = useState<Step>(1);

  // Passo 1 — Campanha
  const [objective, setObjective] = useState<Objective>('leads');
  const [name, setName] = useState('');
  const [campaignId, setCampaignId] = useState<string | null>(null);

  // Passo 2 — Conjunto
  const [conversion, setConversion] = useState<Conversion>('form');
  const [budget, setBudget] = useState('5,00');
  const [geoQuery, setGeoQuery] = useState('');
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [geoOpen, setGeoOpen] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState<GeoResult | null>(null);
  const [radius, setRadius] = useState(17);
  const [estimate, setEstimate] = useState<{ lower: number; upper: number } | null>(null);
  const [estLoading, setEstLoading] = useState(false);
  const [adsetId, setAdsetId] = useState<string | null>(null);

  // Passo 3 — Anúncio
  const [imageHash, setImageHash] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageUploading, setImageUploading] = useState(false);
  const [adName, setAdName] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [description, setDescription] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [cta, setCta] = useState('LEARN_MORE');
  const [forms, setForms] = useState<LeadForm[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [selectedFormId, setSelectedFormId] = useState('');
  const [adId, setAdId] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Destino do anúncio derivado da conversão escolhida no passo 2.
  const destination: 'form' | 'site' = conversion === 'form' ? 'form' : 'site';

  const budgetCents = parseEurosToCents(budget);
  const budgetOk = budgetCents !== null && budgetCents >= MIN_DAILY_CENTS;

  // --- Passo 1: criar campanha e avançar -----------------------------------
  const createCampaign = useCallback(async () => {
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
      setCampaignId(j.campaign_id);
      setStep(2);
    } catch {
      setErr('Não foi possível criar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  }, [name, objective]);

  // --- Pesquisa de localização (debounce) ----------------------------------
  const geoSelectedName = useRef<string>('');
  useEffect(() => {
    if (selectedCity && geoQuery === geoSelectedName.current) return; // já escolhido
    const q = geoQuery.trim();
    if (q.length < 2) {
      setGeoResults([]);
      return;
    }
    setGeoLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/meta-ads/geo-search?q=${encodeURIComponent(q)}`);
        const j = await res.json();
        setGeoResults(Array.isArray(j.results) ? j.results : []);
        setGeoOpen(true);
      } catch {
        setGeoResults([]);
      } finally {
        setGeoLoading(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [geoQuery, selectedCity]);

  const pickCity = useCallback((g: GeoResult) => {
    setSelectedCity(g);
    geoSelectedName.current = g.name;
    setGeoQuery(g.name);
    setGeoOpen(false);
    setGeoResults([]);
  }, []);

  const clearCity = useCallback(() => {
    setSelectedCity(null);
    setEstimate(null);
    setGeoQuery('');
    geoSelectedName.current = '';
  }, []);

  // --- Estimativa de público (quando há cidade + raio + conversão) ----------
  useEffect(() => {
    if (!selectedCity) {
      setEstimate(null);
      return;
    }
    setEstLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/meta-ads/reach-estimate?cityKey=${encodeURIComponent(selectedCity.key)}&radius=${radius}&conversion=${conversion}`,
        );
        const j = await res.json();
        setEstimate(j.estimate ?? null);
      } catch {
        setEstimate(null);
      } finally {
        setEstLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [selectedCity, radius, conversion]);

  // --- Passo 2: criar conjunto ---------------------------------------------
  const createAdSet = useCallback(async () => {
    if (!campaignId || !budgetOk) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/meta-ads/adset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          name: `${name.trim()} — Conjunto`,
          conversion,
          dailyBudgetCents: budgetCents,
          geoCity: selectedCity ? { key: selectedCity.key, name: selectedCity.name, radius } : null,
          advantageAudience: true,
        }),
      });
      const j = await res.json();
      if (!res.ok || j.error) {
        setErr(j.error || 'Não foi possível criar o conjunto.');
        return;
      }
      setAdsetId(j.adset_id);
      setAdName(name.trim());
      // O destino WhatsApp (anúncio de mensagem) chega numa iteração futura;
      // por agora o conjunto fica pronto e o anúncio completa-se no Gestor.
      setStep(conversion === 'whatsapp' ? 'done' : 3);
    } catch {
      setErr('Não foi possível criar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  }, [campaignId, budgetOk, budgetCents, name, conversion, selectedCity, radius]);

  // --- Passo 3: carregar formulários (destino Formulário) -------------------
  useEffect(() => {
    if (step !== 3 || destination !== 'form') return;
    setFormsLoading(true);
    (async () => {
      try {
        const res = await fetch('/api/meta-ads/leadforms');
        const j = await res.json();
        setForms(Array.isArray(j.forms) ? j.forms : []);
      } catch {
        setForms([]);
      } finally {
        setFormsLoading(false);
      }
    })();
  }, [step, destination]);

  // --- Passo 3: enviar a imagem à Meta (devolve hash) -----------------------
  const uploadImage = useCallback(async (file: File) => {
    setErr(null);
    setImageHash(null);
    setImageUploading(true);
    setImagePreview(URL.createObjectURL(file));
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/meta-ads/upload-image', { method: 'POST', body: fd });
      const j = await res.json();
      if (!res.ok || j.error) {
        setErr(j.error || 'Não foi possível enviar a imagem.');
        return;
      }
      setImageHash(j.image_hash);
    } catch {
      setErr('Não foi possível enviar a imagem.');
    } finally {
      setImageUploading(false);
    }
  }, []);

  // A Meta exige sempre um URL externo (no Site é o destino; no Formulário é o
  // link "Ver mais", que não pode ser a Página do Facebook).
  const linkOk = /^https?:\/\/.+/i.test(siteUrl.trim());
  const adReady =
    !!imageHash &&
    !!message.trim() &&
    linkOk &&
    (destination === 'form' ? !!selectedFormId : true);

  // --- Passo 3: criar o anúncio ---------------------------------------------
  const createTheAd = useCallback(async () => {
    if (!adsetId || !adReady) return;
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch('/api/meta-ads/ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adsetId,
          name: adName.trim() || `${name.trim()} — Anúncio`,
          imageHash,
          message: message.trim(),
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          destination,
          link: destination === 'site' ? siteUrl.trim() : undefined,
          leadGenFormId: destination === 'form' ? selectedFormId : undefined,
          ctaType: cta,
        }),
      });
      const j = await res.json();
      if (!res.ok || j.error) {
        setErr(j.error || 'Não foi possível criar o anúncio.');
        return;
      }
      setAdId(j.ad_id);
      setStep('done');
    } catch {
      setErr('Não foi possível criar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  }, [adsetId, adReady, adName, name, imageHash, message, title, description, destination, siteUrl, selectedFormId, cta]);

  const stepLabel =
    step === 1 ? 'Passo 1 de 3 · Campanha'
    : step === 2 ? 'Passo 2 de 3 · Conjunto'
    : step === 3 ? 'Passo 3 de 3 · Anúncio'
    : 'Concluído';

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
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{stepLabel}</p>
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* PASSO 1 — CAMPANHA */}
        {step === 1 && (
          <div className="space-y-4 p-5">
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
                        sel ? 'border-violet-500 bg-violet-50 dark:bg-violet-600/10' : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
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

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Nome da campanha</label>
              <input
                value={name}
                maxLength={200}
                onChange={(e) => setName(e.target.value)}
                placeholder="[Leads] Moradia Seroa V3 · Junho"
                className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <p className="mt-1 text-[11px] text-slate-400">Sugestão: padrão [Tipo] Imóvel · Mês.</p>
            </div>

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
                onClick={() => void createCampaign()}
                disabled={saving || !name.trim()}
                className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-40"
              >
                {saving ? 'A criar...' : 'Continuar'}
              </button>
            </div>
          </div>
        )}

        {/* PASSO 2 — CONJUNTO */}
        {step === 2 && (
          <div className="space-y-4 p-5">
            {/* Onde converter */}
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Onde converter</p>
              <div className="grid grid-cols-3 gap-2">
                {CONVERSIONS.map((conv) => {
                  const Icon = conv.icon;
                  const sel = conversion === conv.key;
                  return (
                    <button
                      key={conv.key}
                      onClick={() => setConversion(conv.key)}
                      title={conv.hint}
                      className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-2.5 text-center transition-colors ${
                        sel ? 'border-violet-500 bg-violet-50 dark:bg-violet-600/10' : 'border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5'
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${sel ? 'text-violet-600 dark:text-violet-300' : 'text-slate-400'}`} />
                      <span className={`text-[11px] font-bold ${sel ? 'text-violet-700 dark:text-violet-200' : 'text-slate-700 dark:text-slate-300'}`}>{conv.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">{CONVERSIONS.find((x) => x.key === conversion)?.hint}</p>
            </div>

            {/* Orçamento diário */}
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Orçamento diário</label>
              <div className="relative">
                <input
                  value={budget}
                  inputMode="decimal"
                  onChange={(e) => setBudget(e.target.value)}
                  className={`w-full rounded-lg border bg-white dark:bg-white/5 px-3 py-2 pr-8 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                    budgetOk ? 'border-slate-300 dark:border-white/15 focus:ring-violet-500' : 'border-red-400 focus:ring-red-400'
                  }`}
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">€</span>
              </div>
              <p className={`mt-1 text-[11px] ${budgetOk ? 'text-slate-400' : 'text-red-500'}`}>
                Mínimo desta conta: 2,59 € por dia.
              </p>
            </div>

            {/* Localização + raio */}
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Localização e raio</label>
              <div className="relative">
                <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={geoQuery}
                  onChange={(e) => { setGeoQuery(e.target.value); if (selectedCity) setSelectedCity(null); }}
                  onFocus={() => { if (geoResults.length) setGeoOpen(true); }}
                  placeholder="Cidade ou localidade (ex.: Paços de Ferreira)"
                  className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 pl-8 pr-8 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
                {geoLoading && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />}
                {selectedCity && !geoLoading && (
                  <button onClick={clearCity} aria-label="Limpar localização" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
                {geoOpen && geoResults.length > 0 && !selectedCity && (
                  <ul className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-dark-card shadow-lg">
                    {geoResults.map((g) => (
                      <li key={g.key}>
                        <button
                          onClick={() => pickCity(g)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-white/5"
                        >
                          <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                          <span className="min-w-0">
                            <span className="block truncate font-semibold text-slate-800 dark:text-slate-200">{g.name}</span>
                            <span className="block truncate text-[11px] text-slate-400">{[g.region, g.countryName].filter(Boolean).join(', ')}</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <select
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                disabled={!selectedCity}
                className="mt-2 w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
              >
                {RADIUS_OPTIONS.map((r) => <option key={r} value={r}>Raio {r} km</option>)}
              </select>

              <div className="mt-2 rounded-lg border border-sky-200 dark:border-sky-500/20 bg-sky-50 dark:bg-sky-500/10 px-3 py-2 text-xs text-sky-800 dark:text-sky-300">
                {!selectedCity ? (
                  <span>Escolhe uma localização para ver o público estimado. Sem localização, fica Portugal inteiro.</span>
                ) : estLoading ? (
                  <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> A estimar público...</span>
                ) : estimate ? (
                  <span>Público estimado: <b>~{fmtInt(estimate.lower)} a {fmtInt(estimate.upper)}</b> pessoas nesta zona e raio.</span>
                ) : (
                  <span>Estimativa indisponível agora (a Meta calcula ao publicar).</span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Localizações validadas pela Meta. Outros países só no Gestor de Anúncios.</p>
            </div>

            {/* Público Advantage+ */}
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Público</p>
              <div className="flex items-center gap-3 rounded-xl border border-violet-300 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-600/10 px-3 py-2.5">
                <Sparkles className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
                <span className="text-xs font-semibold text-violet-800 dark:text-violet-200">Advantage+ (a Meta encontra quem responde melhor)</span>
              </div>
            </div>

            <div className="flex gap-2.5 rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Cria o conjunto <b>em pausa</b>{conversion === 'whatsapp' ? ' (o anúncio de mensagem completa-se no Gestor por agora).' : ' e segue para o anúncio (imagem, texto e destino).'}</p>
            </div>

            {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}

            <div className="flex gap-2">
              <button onClick={() => { setStep(1); setErr(null); }} className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 dark:bg-white/5 px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
              <button
                onClick={() => void createAdSet()}
                disabled={saving || !budgetOk}
                className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-40"
              >
                {saving ? 'A criar...' : conversion === 'whatsapp' ? 'Criar conjunto (em pausa)' : 'Criar conjunto e continuar'}
              </button>
            </div>
          </div>
        )}

        {/* PASSO 3 — ANÚNCIO */}
        {step === 3 && (
          <div className="space-y-4 p-5">
            {/* Formato */}
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Formato</p>
              <div className="flex items-center gap-3 rounded-xl border border-violet-300 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-600/10 px-3 py-2.5">
                <ImageIcon className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-300" />
                <span className="text-xs font-semibold text-violet-800 dark:text-violet-200">Uma imagem (o vídeo edita-se no Gestor até a Meta libertar a capacidade)</span>
              </div>
            </div>

            {/* Imagem */}
            <div>
              <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Imagem do anúncio</p>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-white/15 px-3 py-5 text-center hover:bg-slate-50 dark:hover:bg-white/5">
                {imagePreview ? (
                  <img src={imagePreview} alt="Pré-visualização" className="max-h-36 rounded-lg object-contain" />
                ) : (
                  <Upload className="h-6 w-6 text-slate-400" />
                )}
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {imageUploading ? 'A enviar à Meta...' : imageHash ? 'Enviada à Meta ✓ (clica para trocar)' : 'Arrasta ou clica para escolher uma imagem'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); }}
                />
              </label>
            </div>

            {/* Destino */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Destino · {destination === 'form' ? 'Formulário' : 'Site'}</p>
              {destination === 'form' && (
                <>
                  <div className="relative">
                    <FileText className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <select
                      value={selectedFormId}
                      onChange={(e) => setSelectedFormId(e.target.value)}
                      disabled={formsLoading}
                      className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 pl-8 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50"
                    >
                      <option value="">{formsLoading ? 'A carregar formulários...' : 'Escolhe um formulário'}</option>
                      {forms.map((f) => <option key={f.id} value={f.id}>{f.name}{f.status && f.status !== 'ACTIVE' ? ` (${f.status.toLowerCase()})` : ''}</option>)}
                    </select>
                  </div>
                  {forms.length === 0 && !formsLoading && (
                    <p className="text-[11px] text-slate-400">Sem formulários na Página ainda. Cria um no editor de formulários (em breve) ou no Gestor.</p>
                  )}
                </>
              )}
              <div className="relative">
                <Globe className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={siteUrl}
                  onChange={(e) => setSiteUrl(e.target.value)}
                  placeholder="https://joaofilipefonseca.pt/imovel"
                  className={`w-full rounded-lg border bg-white dark:bg-white/5 pl-8 pr-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 ${
                    !siteUrl.trim() || linkOk ? 'border-slate-300 dark:border-white/15 focus:ring-violet-500' : 'border-red-400 focus:ring-red-400'
                  }`}
                />
              </div>
              <p className="text-[11px] text-slate-400">
                {destination === 'form'
                  ? 'URL do botão "Ver mais" (o teu site). A Meta exige um link externo, mesmo com formulário.'
                  : 'URL da página de destino (com http:// ou https://).'}
              </p>
            </div>

            {/* Criativo */}
            <div className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Texto do anúncio</p>
              <input
                value={title}
                maxLength={255}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Título (ex.: Avaliação gratuita do seu imóvel)"
                className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <textarea
                value={message}
                rows={3}
                maxLength={2000}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Texto principal (a mensagem que aparece no anúncio)"
                className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <input
                value={description}
                maxLength={255}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descrição (opcional)"
                className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              />
              <select
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-white/15 bg-white dark:bg-white/5 px-3 py-2 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                {CTA_OPTIONS.map((o) => <option key={o.value} value={o.value}>Apelo à acção: {o.label}</option>)}
              </select>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-600/10 px-2.5 py-1 text-[11px] font-semibold text-violet-700 dark:text-violet-200">
                <Sparkles className="h-3 w-3" /> Otimizar texto por pessoa: ON
              </span>
            </div>

            <div className="flex gap-2.5 rounded-xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2.5 text-xs leading-relaxed text-amber-800 dark:text-amber-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Cria o anúncio <b>em pausa</b> na Meta. Reveês tudo e publicas tu quando quiseres.</p>
            </div>

            {err && <p className="text-xs text-red-600 dark:text-red-400">{err}</p>}

            <div className="flex gap-2">
              <button onClick={() => { setStep(2); setErr(null); }} className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-100 dark:bg-white/5 px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-200">
                <ArrowLeft className="h-4 w-4" /> Voltar
              </button>
              <button
                onClick={() => void createTheAd()}
                disabled={saving || !adReady}
                className="flex-1 rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-40"
              >
                {saving ? 'A criar...' : 'Criar anúncio (em pausa)'}
              </button>
            </div>
          </div>
        )}

        {/* CONCLUÍDO */}
        {step === 'done' && (
          <div className="space-y-4 p-5">
            <div className="flex flex-col items-center gap-2 py-3 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/15">
                <Check className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{adId ? 'Anúncio criado em pausa' : 'Campanha e conjunto criados em pausa'}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {adId ? (
                  <>Campanha, conjunto e anúncio ficam <b>em pausa</b> (não gastam nada). Reveês tudo e <b>publicas tu</b> quando quiseres. Aparece na lista após o próximo sync.</>
                ) : (
                  <>Ficam <b>em pausa</b> (não gastam nada). O <b>anúncio</b> completa-se no Gestor de Anúncios (o destino WhatsApp liga-se aqui numa próxima iteração). Aparece na lista após o próximo sync.</>
                )}
              </p>
              {adId ? <p className="text-[11px] text-slate-400">Anúncio: {adId}</p> : adsetId && <p className="text-[11px] text-slate-400">Conjunto: {adsetId}</p>}
            </div>
            <button onClick={onCreated} className="w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white hover:bg-violet-700">Concluir</button>
          </div>
        )}
      </div>
    </div>
  );
}
