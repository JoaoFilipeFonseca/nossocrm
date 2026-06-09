'use client';

/**
 * IMO-7 Fase 1 — Agente de Divulgação (secção "Divulgação" da ficha do imóvel).
 * Mostra o comprador ideal + copy dos 3 canais (RE/MAX, Idealista, Meta Ads).
 * "Gerar" cria SEMPRE uma versão nova (histórico para comparar); o selector alterna versões.
 * A IA prepara; o João copia/edita e publica. A IA nunca publica.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Sparkles, RotateCw, Copy, Check, Target, Megaphone, Images, Scissors, ListChecks, ArrowRight } from 'lucide-react';

type Canal = { titulo: string; corpo: string };
type Meta = { titulo: string; corpo: string; cta: string };
type FotoDecisao = { id: string; motivo: string };
type FotosOrdem = { capa_id: string | null; ordem: FotoDecisao[]; cortar: FotoDecisao[] };
type Accao = 'fotos' | 'portais' | 'anuncio' | 'cruzamentos' | 'acompanhar' | 'nenhuma';
type Passo = { titulo: string; descricao: string; accao: Accao };
type Plano = { passos: Passo[] };
interface Version {
  id: string;
  versao: number;
  comprador_ideal: { perfis: string[]; angulo: string } | null;
  copy_canais: { remax: Canal; idealista: Canal; meta: Meta } | null;
  fotos_ordem?: FotosOrdem | null;
  plano?: Plano | null;
  modelo: string | null;
  created_at: string;
}
type FotoRef = { id: string; url: string | null; caption: string | null };

const ACCAO_CTA: Record<Accao, { label: string; href: string } | null> = {
  fotos: null,
  portais: null,
  anuncio: { label: 'Criar anúncio', href: '/anuncios' },
  cruzamentos: { label: 'Ver cruzamentos', href: '/cruzamentos' },
  acompanhar: null,
  nenhuma: null,
};

const CANAIS = [
  { key: 'remax', label: 'RE/MAX' },
  { key: 'idealista', label: 'Idealista' },
  { key: 'meta', label: 'Meta Ads' },
] as const;

export default function ImovelDivulgacao({ imovelId, fotos = [] }: { imovelId: string; fotos?: FotoRef[] }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [fotosVersions, setFotosVersions] = useState<Version[]>([]);
  const [fotosSelId, setFotosSelId] = useState<string | null>(null);
  const [fotosGenerating, setFotosGenerating] = useState(false);
  const [fotosError, setFotosError] = useState<string | null>(null);
  const [planoVersions, setPlanoVersions] = useState<Version[]>([]);
  const [planoSelId, setPlanoSelId] = useState<string | null>(null);
  const [planoGenerating, setPlanoGenerating] = useState(false);
  const [planoError, setPlanoError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'remax' | 'idealista' | 'meta'>('remax');
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/imoveis/${imovelId}/divulgacao`, { cache: 'no-store' });
      const json = await res.json();
      if (json.ok) {
        setVersions(json.versions ?? []);
        setSelId((json.versions ?? [])[0]?.id ?? null);
        setFotosVersions(json.fotosVersions ?? []);
        setFotosSelId((json.fotosVersions ?? [])[0]?.id ?? null);
        setPlanoVersions(json.planoVersions ?? []);
        setPlanoSelId((json.planoVersions ?? [])[0]?.id ?? null);
      }
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  }, [imovelId]);

  async function gerarPlano() {
    setPlanoGenerating(true);
    setPlanoError(null);
    try {
      const res = await fetch(`/api/imoveis/${imovelId}/divulgacao/plano`, { method: 'POST' });
      const json = await res.json();
      if (!json.ok) {
        setPlanoError(json.error || 'Não foi possível montar o plano. Tente novamente.');
      } else if (json.version) {
        setPlanoVersions((prev) => [json.version, ...prev]);
        setPlanoSelId(json.version.id);
      }
    } catch {
      setPlanoError('Erro de rede. Tente novamente.');
    } finally {
      setPlanoGenerating(false);
    }
  }

  async function gerarFotos() {
    setFotosGenerating(true);
    setFotosError(null);
    try {
      const res = await fetch(`/api/imoveis/${imovelId}/divulgacao/fotos`, { method: 'POST' });
      const json = await res.json();
      if (!json.ok) {
        setFotosError(json.error || 'Não foi possível analisar as fotos. Tente novamente.');
      } else if (json.version) {
        setFotosVersions((prev) => [json.version, ...prev]);
        setFotosSelId(json.version.id);
      }
    } catch {
      setFotosError('Erro de rede. Tente novamente.');
    } finally {
      setFotosGenerating(false);
    }
  }

  useEffect(() => { void load(); }, [load]);

  async function gerar() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/imoveis/${imovelId}/divulgacao`, { method: 'POST' });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error || 'Não foi possível gerar. Tente novamente.');
      } else if (json.version) {
        setVersions((prev) => [json.version, ...prev]);
        setSelId(json.version.id);
        setTab('remax');
      }
    } catch {
      setError('Erro de rede. Tente novamente.');
    } finally {
      setGenerating(false);
    }
  }

  function copyText(key: string, text: string) {
    void navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1800);
  }

  const sel = versions.find((v) => v.id === selId) ?? null;
  const fotosSel = fotosVersions.find((v) => v.id === fotosSelId) ?? null;
  const planoSel = planoVersions.find((v) => v.id === planoSelId) ?? null;
  const dt = (iso: string) => new Date(iso).toLocaleString('pt-PT', { timeZone: 'Europe/Lisbon', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  if (loading) {
    return <p className="text-sm text-slate-500">A carregar…</p>;
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <p className="text-sm text-slate-600 dark:text-slate-300 max-w-2xl">
          O agente prepara a divulgação: define o comprador ideal e escreve a copy à medida para cada canal.
          Tu revês e publicas. A IA nunca publica sozinha.
        </p>
        <button
          onClick={gerar}
          disabled={generating}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {generating ? <RotateCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {versions.length === 0 ? 'Gerar divulgação' : 'Gerar nova versão'}
        </button>
      </div>

      {error && (
        <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">{error}</p>
      )}

      {versions.length === 0 && !generating && (
        <p className="rounded-lg border border-dashed border-slate-300 dark:border-white/10 px-4 py-8 text-center text-sm text-slate-500">
          Ainda não há divulgação gerada para este imóvel. Carregue em “Gerar divulgação”.
        </p>
      )}

      {sel && (
        <>
          {/* Selector de versões (histórico) */}
          {versions.length > 1 && (
            <div className="mb-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500">Versão:</span>
              {versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelId(v.id)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ${v.id === selId ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}
                  title={dt(v.created_at)}
                >
                  v{v.versao}
                </button>
              ))}
            </div>
          )}

          {/* Comprador ideal */}
          {sel.comprador_ideal && (
            <div className="mb-4 rounded-xl border border-slate-200 dark:border-white/10 p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
                <Target className="h-4 w-4 text-blue-600" /> Comprador ideal
              </h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {sel.comprador_ideal.perfis.map((p, i) => (
                  <span key={i} className="rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 px-3 py-1 text-xs font-medium">{p}</span>
                ))}
              </div>
              <p className="mt-3 text-sm text-slate-700 dark:text-slate-300">{sel.comprador_ideal.angulo}</p>
            </div>
          )}

          {/* Copy por canal */}
          {sel.copy_canais && (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 p-4">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100 mb-3">
                <Megaphone className="h-4 w-4 text-blue-600" /> Copy à medida, por canal
              </h3>
              <div className="flex gap-2 flex-wrap mb-3">
                {CANAIS.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => setTab(c.key)}
                    className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold border ${tab === c.key ? 'bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white' : 'bg-white text-slate-600 border-slate-300 dark:bg-transparent dark:text-slate-300 dark:border-white/15'}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
              {CANAIS.filter((c) => c.key === tab).map((c) => {
                const canal = sel.copy_canais![c.key];
                const isMeta = c.key === 'meta';
                const meta = canal as Meta;
                const fullText = isMeta
                  ? `${canal.titulo}\n\n${canal.corpo}\n\n${meta.cta}`
                  : `${canal.titulo}\n\n${canal.corpo}`;
                return (
                  <div key={c.key} className="rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50/60 dark:bg-white/5 p-3.5">
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">Título ({canal.titulo.length} car.)</p>
                    <p className="font-bold text-slate-900 dark:text-slate-100 mb-2">{canal.titulo}</p>
                    <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap">{canal.corpo}</p>
                    {isMeta && (
                      <p className="mt-2 rounded-md bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200"><b>CTA:</b> {meta.cta}</p>
                    )}
                    <div className="mt-3 flex gap-2 flex-wrap">
                      <button
                        onClick={() => copyText(c.key, fullText)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                      >
                        {copied === c.key ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        {copied === c.key ? 'Copiado' : 'Copiar'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <p className="mt-3 text-xs text-slate-400">
            {sel.modelo ? `Gerado por ${sel.modelo} · ` : ''}v{sel.versao} de {dt(sel.created_at)}. Cada geração fica guardada para comparar.
          </p>
        </>
      )}

      {/* Sequência de fotos (IA de visão) */}
      <div className="mt-6 rounded-xl border border-slate-200 dark:border-white/10 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <Images className="h-4 w-4 text-blue-600" /> Sequência de fotos
          </h3>
          <button
            onClick={gerarFotos}
            disabled={fotosGenerating || fotos.length < 2}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {fotosGenerating ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {fotosVersions.length === 0 ? 'Analisar fotos' : 'Analisar de novo'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-3">A IA olha para as fotos e sugere capa, ordem e quais cortar. Tu decides o que aplicar.</p>

        {fotos.length < 2 && (
          <p className="text-xs text-slate-500">São precisas pelo menos 2 fotos no imóvel para o agente sugerir a sequência.</p>
        )}
        {fotosError && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">{fotosError}</p>
        )}

        {fotosSel && (() => {
          const fotoById = new Map(fotos.map((f) => [f.id, f]));
          const fo = fotosSel.fotos_ordem!;
          return (
            <>
              {fotosVersions.length > 1 && (
                <div className="mb-3 flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-slate-500">Versão:</span>
                  {fotosVersions.map((v) => (
                    <button key={v.id} onClick={() => setFotosSelId(v.id)} title={dt(v.created_at)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${v.id === fotosSelId ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
                      v{v.versao}
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {fo.ordem.map((o, idx) => {
                  const f = fotoById.get(o.id);
                  const isCapa = o.id === fo.capa_id;
                  return (
                    <div key={o.id} className="rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden relative">
                      <div className="relative aspect-[4/3] bg-slate-100 dark:bg-white/5">
                        {f?.url ? (
                          <img src={f.url} alt={f.caption ?? ''} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-slate-400">sem imagem</div>
                        )}
                        <span className="absolute top-1.5 left-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/90 text-[11px] font-bold text-white">{idx + 1}</span>
                        {isCapa && <span className="absolute top-1.5 right-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">CAPA</span>}
                      </div>
                      <p className="px-2 py-1.5 text-[11px] text-slate-600 dark:text-slate-300">{o.motivo}</p>
                    </div>
                  );
                })}
              </div>
              {fo.cortar.length > 0 && (
                <div className="mt-3">
                  <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2"><Scissors className="h-3.5 w-3.5" /> Sugeridas para cortar ({fo.cortar.length})</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {fo.cortar.map((o) => {
                      const f = fotoById.get(o.id);
                      return (
                        <div key={o.id} className="rounded-lg border border-slate-200 dark:border-white/10 overflow-hidden opacity-70">
                          <div className="relative aspect-[4/3] bg-slate-100 dark:bg-white/5">
                            {f?.url ? (
                              <img src={f.url} alt={f.caption ?? ''} className="h-full w-full object-cover grayscale" />
                            ) : (
                              <div className="flex h-full items-center justify-center text-xs text-slate-400">sem imagem</div>
                            )}
                            <span className="absolute top-1.5 right-1.5 rounded bg-slate-600 px-1.5 py-0.5 text-[10px] font-bold text-white">cortar</span>
                          </div>
                          <p className="px-2 py-1.5 text-[11px] text-slate-600 dark:text-slate-300">{o.motivo}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              <p className="mt-3 text-xs text-slate-400">
                {fotosSel.modelo ? `Analisado por ${fotosSel.modelo} · ` : ''}v{fotosSel.versao} de {dt(fotosSel.created_at)}. A ordem é uma sugestão; aplica o que fizer sentido.
              </p>
            </>
          );
        })()}
      </div>

      {/* Plano de divulgação passo a passo */}
      <div className="mt-6 rounded-xl border border-slate-200 dark:border-white/10 p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-800 dark:text-slate-100">
            <ListChecks className="h-4 w-4 text-blue-600" /> Plano de divulgação
          </h3>
          <button
            onClick={gerarPlano}
            disabled={planoGenerating}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {planoGenerating ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {planoVersions.length === 0 ? 'Montar plano' : 'Montar de novo'}
          </button>
        </div>
        <p className="text-xs text-slate-500 mb-3">A IA monta o passo a passo de divulgação à medida deste imóvel. Segue na ordem que fizer sentido.</p>

        {planoError && (
          <p className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">{planoError}</p>
        )}

        {planoSel?.plano && (
          <>
            {planoVersions.length > 1 && (
              <div className="mb-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-500">Versão:</span>
                {planoVersions.map((v) => (
                  <button key={v.id} onClick={() => setPlanoSelId(v.id)} title={dt(v.created_at)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ${v.id === planoSelId ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-300'}`}>
                    v{v.versao}
                  </button>
                ))}
              </div>
            )}
            <ol className="space-y-0">
              {planoSel.plano.passos.map((p, idx) => {
                const cta = ACCAO_CTA[p.accao] ?? null;
                return (
                  <li key={idx} className="flex gap-3 items-start border-t border-slate-100 dark:border-white/5 first:border-t-0 py-3">
                    <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300 text-xs font-bold">{idx + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">{p.titulo}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{p.descricao}</p>
                      {cta && (
                        <Link href={cta.href} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                          {cta.label} <ArrowRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
            <p className="mt-3 text-xs text-slate-400">
              {planoSel.modelo ? `Montado por ${planoSel.modelo} · ` : ''}v{planoSel.versao} de {dt(planoSel.created_at)}.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
