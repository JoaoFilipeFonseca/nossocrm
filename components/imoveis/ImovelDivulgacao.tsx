'use client';

/**
 * IMO-7 Fase 1 — Agente de Divulgação (secção "Divulgação" da ficha do imóvel).
 * Mostra o comprador ideal + copy dos 3 canais (RE/MAX, Idealista, Meta Ads).
 * "Gerar" cria SEMPRE uma versão nova (histórico para comparar); o selector alterna versões.
 * A IA prepara; o João copia/edita e publica. A IA nunca publica.
 */
import { useCallback, useEffect, useState } from 'react';
import { Sparkles, RotateCw, Copy, Check, Target, Megaphone } from 'lucide-react';

type Canal = { titulo: string; corpo: string };
type Meta = { titulo: string; corpo: string; cta: string };
interface Version {
  id: string;
  versao: number;
  comprador_ideal: { perfis: string[]; angulo: string } | null;
  copy_canais: { remax: Canal; idealista: Canal; meta: Meta } | null;
  modelo: string | null;
  created_at: string;
}

const CANAIS = [
  { key: 'remax', label: 'RE/MAX' },
  { key: 'idealista', label: 'Idealista' },
  { key: 'meta', label: 'Meta Ads' },
] as const;

export default function ImovelDivulgacao({ imovelId }: { imovelId: string }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [selId, setSelId] = useState<string | null>(null);
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
      }
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  }, [imovelId]);

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
    </div>
  );
}
