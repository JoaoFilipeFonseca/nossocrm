'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Megaphone, Smartphone, Clapperboard, FileText, Home, Sparkles, Eye, Save, ArrowLeft, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ImovelSearchCombobox, imovelLabel, type ImovelLite } from '@/components/ui/ImovelSearchCombobox';
import {
  FORMAT_LABELS,
  VARIANT_LABELS,
  dimensionsFor,
  type RenderFormat,
  type RenderRatio,
  type TemplateVariant,
} from '@/lib/criativos/templates';

interface FotoLite {
  storage_path: string;
  url: string | null;
  is_principal: boolean;
  caption: string | null;
}

const FORMAT_ICONS: Record<RenderFormat, React.ComponentType<{ className?: string }>> = {
  anuncio: Megaphone,
  post: Smartphone,
  story: Clapperboard,
  flyer: FileText,
};

const FORMAT_HINTS: Record<RenderFormat, string> = {
  anuncio: '1080×1080 · imagem + texto do anúncio',
  post: '1080×1080 ou 1080×1350 (ideal Instagram)',
  story: '1080×1920 · capa + texto curto',
  flyer: 'A4 · PDF pronto a imprimir',
};

interface Props {
  onSaved: () => void;
}

export const CreateStudio: React.FC<Props> = ({ onSaved }) => {
  const [format, setFormat] = useState<RenderFormat | null>(null);
  const [ratio, setRatio] = useState<RenderRatio>('square');
  const [variant, setVariant] = useState<TemplateVariant>('classico');
  const [imovel, setImovel] = useState<ImovelLite | null>(null);
  const [fotos, setFotos] = useState<FotoLite[]>([]);
  const [fotoPath, setFotoPath] = useState<string | null>(null);
  const [briefing, setBriefing] = useState('');
  const [headline, setHeadline] = useState('');
  const [sub, setSub] = useState('');
  const [cta, setCta] = useState('');
  const [descricao, setDescricao] = useState('');
  const [destaques, setDestaques] = useState('');
  const [legenda, setLegenda] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [busyCopy, setBusyCopy] = useState(false);
  const [busyPreview, setBusyPreview] = useState(false);
  const [busySave, setBusySave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setFotos([]);
    setFotoPath(null);
    if (!imovel) return;
    (async () => {
      try {
        const res = await fetch(`/api/criativos/imovel-fotos?imovelId=${imovel.id}`, { cache: 'no-store' });
        const data = await res.json();
        if (!cancelled && res.ok) {
          const list: FotoLite[] = data.fotos ?? [];
          setFotos(list);
          const principal = list.find((f) => f.is_principal) ?? list[0];
          setFotoPath(principal?.storage_path ?? null);
        }
      } catch {
        /* sem fotos não bloqueia: o template tem fundo da marca */
      }
    })();
    return () => { cancelled = true; };
  }, [imovel?.id]);

  // Limpar o object URL da pré-visualização anterior.
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const dims = useMemo(() => (format ? dimensionsFor(format, ratio) : null), [format, ratio]);

  const renderBody = (preview: boolean) => ({
    format,
    ratio,
    variant,
    imovel_id: imovel?.id ?? null,
    foto_path: fotoPath,
    texts: {
      headline: headline.trim(),
      sub: sub.trim() || null,
      cta: cta.trim() || null,
      descricao: format === 'flyer' ? (descricao.trim() || null) : null,
      destaques: format === 'flyer' ? destaques.split('\n').map((d) => d.trim()).filter(Boolean).slice(0, 6) : [],
    },
    legenda: legenda.trim() || null,
    preview,
  });

  const gerarCopy = async () => {
    if (!format) return;
    setBusyCopy(true);
    setError(null);
    try {
      const res = await fetch('/api/criativos/copy', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ format, imovel_id: imovel?.id ?? null, briefing: briefing.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data?.error || 'Não foi possível gerar a copy.');
        return;
      }
      setHeadline(data.copy.headline || '');
      setSub(data.copy.sub || '');
      setCta(data.copy.cta || '');
      setLegenda(data.copy.legenda || '');
      if (format === 'flyer') {
        setDescricao(data.copy.descricao || '');
        setDestaques((data.copy.destaques || []).join('\n'));
      }
    } catch (e: any) {
      setError(e?.message || 'Não foi possível gerar a copy.');
    } finally {
      setBusyCopy(false);
    }
  };

  const preVisualizar = async () => {
    if (!format || !headline.trim()) { setError('Escreva (ou gere) a headline primeiro.'); return; }
    setBusyPreview(true);
    setError(null);
    try {
      const res = await fetch('/api/criativos/render', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(renderBody(true)),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Falhou a pré-visualização.');
        return;
      }
      const blob = await res.blob();
      setPreviewUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
    } catch (e: any) {
      setError(e?.message || 'Falhou a pré-visualização.');
    } finally {
      setBusyPreview(false);
    }
  };

  const gerarEGuardar = async () => {
    if (!format || !headline.trim()) { setError('Escreva (ou gere) a headline primeiro.'); return; }
    setBusySave(true);
    setError(null);
    try {
      const res = await fetch('/api/criativos/render', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(renderBody(false)),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || 'Não foi possível guardar.');
        return;
      }
      setSavedOk(true);
      setTimeout(() => { setSavedOk(false); onSaved(); }, 900);
    } catch (e: any) {
      setError(e?.message || 'Não foi possível guardar.');
    } finally {
      setBusySave(false);
    }
  };

  /* Passo 1 — escolher formato */
  if (!format) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(Object.keys(FORMAT_LABELS) as RenderFormat[]).map((f) => {
          const Icon = FORMAT_ICONS[f];
          return (
            <button
              key={f}
              onClick={() => { setFormat(f); setRatio(f === 'post' ? 'portrait' : 'square'); setPreviewUrl(null); }}
              className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-6 text-center hover:border-primary-400 dark:hover:border-primary-600 transition-colors"
            >
              <Icon className="h-8 w-8 mx-auto text-primary-600 mb-2" />
              <div className="text-sm font-semibold text-slate-900 dark:text-white">{FORMAT_LABELS[f]}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{FORMAT_HINTS[f]}</div>
            </button>
          );
        })}
        <p className="md:col-span-2 text-xs text-slate-500 dark:text-slate-400">
          Peças compostas com as cores e identidade do Brand Kit (Definições → Marca) e as fotos reais do imóvel. Cada "Gerar e guardar" cria uma peça NOVA na biblioteca, nunca substitui nada.
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Controlo */}
      <div className="space-y-4">
        <button onClick={() => { setFormat(null); setPreviewUrl(null); setError(null); }} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-primary-600">
          <ArrowLeft className="h-3.5 w-3.5" /> escolher outro formato
        </button>

        <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{FORMAT_LABELS[format]}</h2>
            {format === 'post' && (
              <div className="flex items-center gap-1.5">
                {(['square', 'portrait'] as RenderRatio[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => { setRatio(r); setPreviewUrl(null); }}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                      ratio === r
                        ? 'bg-primary-500/10 border-primary-500 text-primary-700 dark:text-primary-300 font-semibold'
                        : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {r === 'square' ? '◻ 1080×1080' : '▯ 1080×1350 (ideal IG)'}
                  </button>
                ))}
              </div>
            )}
            {dims && format !== 'post' && (
              <span className="text-xs text-slate-400">{format === 'flyer' ? 'A4 · PDF' : `${dims.width}×${dims.height}`}</span>
            )}
          </div>

          {format !== 'flyer' && (
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Template</label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(VARIANT_LABELS) as TemplateVariant[]).map((v) => (
                  <button
                    key={v}
                    onClick={() => { setVariant(v); setPreviewUrl(null); }}
                    className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
                      variant === v
                        ? 'bg-primary-500/10 border-primary-500 text-primary-700 dark:text-primary-300 font-semibold'
                        : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {VARIANT_LABELS[v]}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Imóvel (puxa fotos, preço e detalhes)</label>
            {imovel ? (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="inline-flex items-center gap-1.5 text-slate-700 dark:text-slate-200"><Home className="h-4 w-4 text-slate-400" /> {imovelLabel(imovel)}</span>
                <button type="button" onClick={() => { setImovel(null); setPreviewUrl(null); }} className="text-xs text-rose-600 hover:text-rose-700 inline-flex items-center gap-1"><X className="h-3 w-3" /> remover</button>
              </div>
            ) : (
              <ImovelSearchCombobox onSelect={(i) => { setImovel(i); setPreviewUrl(null); }} />
            )}
            {fotos.length > 0 && (
              <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                {fotos.slice(0, 12).map((f) => (
                  <button
                    key={f.storage_path}
                    onClick={() => { setFotoPath(f.storage_path); setPreviewUrl(null); }}
                    className={`shrink-0 rounded-lg overflow-hidden border-2 ${fotoPath === f.storage_path ? 'border-primary-500' : 'border-transparent opacity-80 hover:opacity-100'}`}
                    title={f.caption || 'Usar esta foto'}
                  >
                    {f.url ? (
                       
                      <img src={f.url} alt="" className="h-14 w-20 object-cover" />
                    ) : (
                      <span className="h-14 w-20 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-400">sem foto</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Indicações para a IA (opcional)</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={briefing}
                onChange={(e) => setBriefing(e.target.value)}
                placeholder="Ex.: focar o jardim e a luz natural"
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
              />
              <Button size="sm" variant="outline" onClick={gerarCopy} disabled={busyCopy}>
                <Sparkles className="h-4 w-4 mr-1" /> {busyCopy ? 'A gerar…' : 'Gerar copy com IA'}
              </Button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Headline (na imagem)</label>
            <input
              type="text"
              value={headline}
              maxLength={90}
              onChange={(e) => { setHeadline(e.target.value); }}
              placeholder="Ex.: Moradia T3 com jardim em Paços de Ferreira"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Frase de apoio</label>
              <input
                type="text"
                value={sub}
                maxLength={160}
                onChange={(e) => setSub(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">CTA (botão na imagem)</label>
              <input
                type="text"
                value={cta}
                maxLength={70}
                onChange={(e) => setCta(e.target.value)}
                placeholder="Envie mensagem com a palavra VISITA"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          {format === 'flyer' && (
            <>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Descrição (parágrafo do flyer)</label>
                <textarea
                  value={descricao}
                  rows={3}
                  maxLength={600}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">Destaques (um por linha, máximo 6)</label>
                <textarea
                  value={destaques}
                  rows={4}
                  onChange={(e) => setDestaques(e.target.value)}
                  placeholder={'Jardim com churrasqueira\nGaragem para 2 carros'}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
              Legenda / texto do {format === 'anuncio' ? 'anúncio' : format === 'flyer' ? 'registo' : 'post'} (fica guardado com a peça)
            </label>
            <textarea
              value={legenda}
              rows={4}
              maxLength={3000}
              onChange={(e) => setLegenda(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
            />
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-sm text-rose-700 dark:text-rose-200">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
            <Button size="sm" variant="outline" onClick={preVisualizar} disabled={busyPreview}>
              <Eye className="h-4 w-4 mr-1" /> {busyPreview ? 'A compor…' : 'Pré-visualizar'}
            </Button>
            <Button size="sm" onClick={gerarEGuardar} disabled={busySave}>
              <Save className="h-4 w-4 mr-1" /> {busySave ? 'A guardar…' : savedOk ? 'Guardado ✓' : 'Gerar e guardar na biblioteca'}
            </Button>
          </div>
        </div>
      </div>

      {/* Pré-visualização */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center min-h-[320px]">
        {previewUrl ? (
           
          <img
            src={previewUrl}
            alt="Pré-visualização da peça"
            className={`rounded-xl border border-slate-200 dark:border-white/10 max-w-full ${format === 'story' ? 'max-h-[560px]' : 'max-h-[480px]'}`}
          />
        ) : (
          <div className="text-center text-sm text-slate-400 dark:text-slate-500 px-6">
            <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
            A pré-visualização aparece aqui. Escolha o imóvel, escreva ou gere a copy e carregue em "Pré-visualizar".
          </div>
        )}
        {dims && previewUrl && (
          <p className="text-[11px] text-slate-400 mt-2">{format === 'flyer' ? 'A4 (o ficheiro final é PDF)' : `${dims.width}×${dims.height} px`}</p>
        )}
      </div>
    </div>
  );
};

export default CreateStudio;
