'use client';

/**
 * MA-CREATE (Tier 4) — construtor de anúncios no CRM. Wizard por fases.
 * PASSO 1 (Campanha): objectivo (Leads/Tráfego/Interação) + nome + defaults
 *   travados do João; cria a campanha EM PAUSA na Meta (audit) e avança.
 * PASSO 2 (Conjunto): onde converter (Formulário/Site/WhatsApp) + orçamento
 *   diário (mínimo da conta) + localização (pesquisa Meta) + raio + público
 *   estimado + Advantage+; cria o conjunto EM PAUSA, encadeado ao campaign_id.
 * As fases seguintes (Anúncio, Formulário) acrescentam-se a este shell.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  X, Target, MousePointerClick, MessageCircle, AlertTriangle, Check,
  FileText, Globe, MapPin, Sparkles, ArrowLeft, Loader2,
} from 'lucide-react';

type Objective = 'leads' | 'trafego' | 'interacao';
type Conversion = 'form' | 'site' | 'whatsapp';
type Step = 1 | 2 | 'done';

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

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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
      setStep('done');
    } catch {
      setErr('Não foi possível criar. Tente de novo.');
    } finally {
      setSaving(false);
    }
  }, [campaignId, budgetOk, budgetCents, name, conversion, selectedCity, radius]);

  const stepLabel = step === 1 ? 'Passo 1 de 3 · Campanha' : step === 2 ? 'Passo 2 de 3 · Conjunto' : 'Concluído';

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
              <p>Cria o conjunto <b>em pausa</b>. O anúncio (criativo e destino) chega na próxima fase do construtor.</p>
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
                {saving ? 'A criar...' : 'Criar conjunto (em pausa)'}
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
              <p className="text-sm font-bold text-slate-900 dark:text-white">Campanha e conjunto criados em pausa</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Ficam <b>em pausa</b> (não gastam nada). O <b>anúncio</b> (criativo, destino e CTA) chega na próxima fase do construtor; entretanto podes completá-lo no Gestor de Anúncios. Aparece na lista após o próximo sync.
              </p>
              {adsetId && <p className="text-[11px] text-slate-400">Conjunto: {adsetId}</p>}
            </div>
            <button onClick={onCreated} className="w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-bold text-white hover:bg-violet-700">Concluir</button>
          </div>
        )}
      </div>
    </div>
  );
}
