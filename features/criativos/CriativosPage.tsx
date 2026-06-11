'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Archive, Star, Search, Filter, X, Mail, MessageCircle, Smartphone, Megaphone, FileText, Image as ImageIcon, FileCheck2, BookOpen, Pin, Trash2, Copy as CopyIcon, Plus, Upload, Lightbulb, Bookmark, PenLine, Home, Download, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AddPieceModal, ADD_MODE_META, type AddMode } from './AddPieceModal';
import { ImovelSearchCombobox, imovelLabel, type ImovelLite } from '@/components/ui/ImovelSearchCombobox';
import {
  TYPE_LABELS as SHARED_TYPE_LABELS,
  ORIGIN_LABELS,
  STATUS_LABELS,
  STATUS_OPTIONS,
  CREATIVE_ORIGINS,
  parseUsages,
  type CreativeOrigin,
  type CreativeStatus,
  type CreativeUsage,
} from '@/lib/criativos/shared';

type Creative = {
  id: string;
  type: string;
  channel: string | null;
  title: string | null;
  subject: string | null;
  content: string;
  deal_id: string | null;
  contact_id: string | null;
  imovel_id: string | null;
  tags: string[];
  is_favorite: boolean;
  is_template: boolean;
  status: string;
  origin: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  file_url: string | null;
  usages: unknown;
  parent_id: string | null;
  ai_provider: string | null;
  ai_model: string | null;
  ai_cost_usd: number | null;
  metric_opens: number | null;
  metric_replies: number | null;
  metric_clicks: number | null;
  metric_impressions: number | null;
  metric_conversions: number | null;
  performance_score: number | null;
  created_at: string;
  updated_at: string;
};

const TYPE_LABELS: Record<string, string> = SHARED_TYPE_LABELS;

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  email: Mail,
  whatsapp: MessageCircle,
  sms: Smartphone,
  social_post: Megaphone,
  organic_post: Smartphone,
  carousel: ImageIcon,
  story: ImageIcon,
  story_cover: ImageIcon,
  ad_copy: Megaphone,
  blog_article: BookOpen,
  imovel_description: FileText,
  sales_script: FileCheck2,
  briefing: FileText,
  swot: FileText,
  proposal: FileCheck2,
  pdf: FileText,
  flyer: FileText,
  banner: ImageIcon,
  idea: Lightbulb,
  reference: Bookmark,
};

const ORIGIN_BADGE: Record<string, string> = {
  created: 'bg-primary-500/10 text-primary-700 dark:text-primary-300',
  imported: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  reference: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
};

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300',
  approved: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  published: 'bg-sky-100 dark:bg-sky-500/15 text-sky-700 dark:text-sky-300',
  sent: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300',
  rejected: 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300',
};

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatUsageDate(ymd: string) {
  const [y, m, d] = ymd.split('-');
  return `${d}/${m}/${y}`;
}

function usagesLine(usages: CreativeUsage[]): string {
  return usages.map((u) => `${u.channel} (${formatUsageDate(u.used_on)})`).join(' · ');
}

function snippet(text: string, max = 220) {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? clean.slice(0, max) + '…' : clean;
}

export const CriativosPage: React.FC = () => {
  const [items, setItems] = useState<Creative[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [originFilter, setOriginFilter] = useState<CreativeOrigin[]>([]);
  const [statusFilter, setStatusFilter] = useState<CreativeStatus[]>([]);
  const [imovelFilter, setImovelFilter] = useState<ImovelLite | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [templatesOnly, setTemplatesOnly] = useState(false);
  const [selected, setSelected] = useState<Creative | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addMode, setAddMode] = useState<AddMode | null>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const addMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (addMenuRef.current && !addMenuRef.current.contains(e.target as Node)) setAddMenuOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      typeFilter.forEach((t) => params.append('type', t));
      originFilter.forEach((o) => params.append('origin', o));
      statusFilter.forEach((s) => params.append('status', s));
      if (imovelFilter) params.set('imovelId', imovelFilter.id);
      if (favoritesOnly) params.set('favorites', '1');
      if (templatesOnly) params.set('templates', '1');
      if (search.trim()) params.set('q', search.trim());
      const res = await fetch(`/api/criativos?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || res.statusText);
        setItems([]);
      } else {
        setItems(data.items ?? []);
      }
    } catch (e: any) {
      setError(e?.message || 'falhou carregar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
     
  }, [typeFilter.join(','), originFilter.join(','), statusFilter.join(','), imovelFilter?.id, favoritesOnly, templatesOnly]);

  const filtered = items;
  const hasActiveFilters = typeFilter.length > 0 || originFilter.length > 0 || statusFilter.length > 0 || !!imovelFilter || favoritesOnly || templatesOnly || !!search;

  const allTypes = useMemo(() => Array.from(new Set(items.map((i) => i.type))).sort(), [items]);
  const typesToOffer = allTypes.length > 0 ? allTypes : ['social_post', 'organic_post', 'ad_copy', 'flyer', 'idea', 'reference'];

  const patchLocal = (id: string, patch: Partial<Creative>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
    setSelected((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
  };

  const toggleFav = async (id: string, current: boolean) => {
    patchLocal(id, { is_favorite: !current });
    await fetch(`/api/criativos/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ is_favorite: !current }),
    });
  };

  const toggleTemplate = async (id: string, current: boolean) => {
    patchLocal(id, { is_template: !current });
    await fetch(`/api/criativos/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ is_template: !current }),
    });
  };

  const setStatus = async (id: string, status: CreativeStatus) => {
    patchLocal(id, { status });
    await fetch(`/api/criativos/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status }),
    });
  };

  const archive = async (id: string) => {
    if (!confirm('Arquivar esta peça? Pode ser recuperada mais tarde.')) return;
    setItems((prev) => prev.filter((it) => it.id !== id));
    if (selected?.id === id) setSelected(null);
    await fetch(`/api/criativos/${id}`, { method: 'DELETE' });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Archive className="h-6 w-6 text-primary-600" />
            Biblioteca
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Todos os seus activos digitais: o que criou, importou e guardou como referência. Tudo fica guardado até apagar.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {loading ? 'A carregar…' : `${filtered.length} ${filtered.length === 1 ? 'peça' : 'peças'}`}
          </span>
          <div className="relative" ref={addMenuRef}>
            <Button size="sm" onClick={() => setAddMenuOpen((v) => !v)}>
              <Plus className="h-4 w-4 mr-1" /> Adicionar <ChevronDown className="h-3.5 w-3.5 ml-1" />
            </Button>
            {addMenuOpen && (
              <div className="absolute right-0 mt-1 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-40">
                {(Object.keys(ADD_MODE_META) as AddMode[]).map((m) => {
                  const meta = ADD_MODE_META[m];
                  const Icon = meta.icon;
                  return (
                    <button
                      key={m}
                      onClick={() => { setAddMode(m); setAddMenuOpen(false); }}
                      className="w-full flex items-start gap-3 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <Icon className="h-4 w-4 mt-0.5 text-primary-600 shrink-0" />
                      <span>
                        <span className="block text-sm font-medium text-slate-900 dark:text-white">{meta.title}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{meta.hint}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') load(); }}
              placeholder="Procurar em título, assunto e conteúdo… (Enter)"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-primary-500"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={favoritesOnly ? 'default' : 'outline'}
              onClick={() => setFavoritesOnly((v) => !v)}
            >
              <Star className="h-4 w-4 mr-1" />
              Favoritos
            </Button>
            <Button
              size="sm"
              variant={templatesOnly ? 'default' : 'outline'}
              onClick={() => setTemplatesOnly((v) => !v)}
            >
              <Pin className="h-4 w-4 mr-1" />
              Templates
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-slate-200 dark:border-white/10">
          <Filter className="h-3.5 w-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 dark:text-slate-400 mr-1">Tipo:</span>
          {typesToOffer.map((t) => {
            const active = typeFilter.includes(t);
            return (
              <button
                key={t}
                onClick={() =>
                  setTypeFilter((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
                }
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  active
                    ? 'bg-primary-500/10 border-primary-500 text-primary-700 dark:text-primary-300'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                {TYPE_LABELS[t] || t}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 mr-1 ml-5">Origem:</span>
          {CREATIVE_ORIGINS.map((o) => {
            const active = originFilter.includes(o);
            return (
              <button
                key={o}
                onClick={() => setOriginFilter((prev) => (prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]))}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  active
                    ? 'bg-primary-500/10 border-primary-500 text-primary-700 dark:text-primary-300'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                {ORIGIN_LABELS[o]}
              </button>
            );
          })}
          <span className="text-xs text-slate-500 dark:text-slate-400 mr-1 ml-3">Estado:</span>
          {STATUS_OPTIONS.map((s) => {
            const active = statusFilter.includes(s);
            return (
              <button
                key={s}
                onClick={() => setStatusFilter((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))}
                className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                  active
                    ? 'bg-primary-500/10 border-primary-500 text-primary-700 dark:text-primary-300'
                    : 'border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5'
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span className="text-xs text-slate-500 dark:text-slate-400 mr-1 ml-5">Imóvel:</span>
          {imovelFilter ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-primary-500/10 border border-primary-500 text-primary-700 dark:text-primary-300">
              <Home className="h-3 w-3" /> {imovelLabel(imovelFilter)}
              <button onClick={() => setImovelFilter(null)} aria-label="Limpar filtro de imóvel"><X className="h-3 w-3" /></button>
            </span>
          ) : (
            <div className="w-full md:w-80">
              <ImovelSearchCombobox onSelect={setImovelFilter} placeholder="Filtrar por imóvel…" />
            </div>
          )}
          {hasActiveFilters && (
            <button
              onClick={() => { setTypeFilter([]); setOriginFilter([]); setStatusFilter([]); setImovelFilter(null); setFavoritesOnly(false); setTemplatesOnly(false); setSearch(''); load(); }}
              className="ml-auto text-xs text-slate-500 hover:text-rose-500 inline-flex items-center gap-1"
            >
              <X className="h-3 w-3" /> limpar
            </button>
          )}
        </div>
      </div>

      {/* List */}
      {error && (
        <div className="mb-4 p-3 rounded-lg bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 text-sm text-rose-700 dark:text-rose-200">
          {error}
        </div>
      )}

      {!loading && filtered.length === 0 && !error && (
        <div className="text-center py-16 bg-white dark:bg-white/5 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl">
          <Archive className="h-10 w-10 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {hasActiveFilters ? 'Nenhuma peça com estes filtros.' : 'A biblioteca ainda está vazia.'}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Use o botão "Adicionar" para carregar ficheiros, guardar ideias e referências.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((it) => {
          const Icon = TYPE_ICONS[it.type] || FileText;
          const usages = parseUsages(it.usages);
          const isImage = !!it.file_url && (it.mime_type || '').startsWith('image/');
          return (
            <article
              key={it.id}
              className="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl p-5 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
            >
              <header className="flex items-start gap-3 mb-3">
                <div className="rounded-lg bg-slate-100 dark:bg-slate-800 p-2">
                  <Icon className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-500 dark:text-slate-400">
                      {TYPE_LABELS[it.type] || it.type}
                    </span>
                    {it.channel && (
                      <span className="text-[10px] text-slate-400">· {it.channel}</span>
                    )}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${ORIGIN_BADGE[it.origin] || ORIGIN_BADGE.created}`}>
                      {ORIGIN_LABELS[it.origin as CreativeOrigin] || it.origin}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${STATUS_BADGE[it.status] || STATUS_BADGE.draft}`}>
                      {STATUS_LABELS[it.status as CreativeStatus] || it.status}
                    </span>
                    {it.is_template && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300">
                        Template
                      </span>
                    )}
                  </div>
                  <h3 className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {it.title || it.subject || 'Sem título'}
                  </h3>
                  {it.subject && it.title && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{it.subject}</p>
                  )}
                </div>
                <button
                  onClick={() => toggleFav(it.id, it.is_favorite)}
                  aria-label={it.is_favorite ? 'Remover favorito' : 'Marcar favorito'}
                  className={it.is_favorite ? 'text-amber-500' : 'text-slate-300 hover:text-amber-400'}
                >
                  <Star className="h-4 w-4" fill={it.is_favorite ? 'currentColor' : 'none'} />
                </button>
              </header>

              {isImage ? (
                <button onClick={() => setSelected(it)} className="block w-full mb-3">
                  { }
                  <img src={it.file_url!} alt={it.title || 'Peça da biblioteca'} className="w-full h-40 object-cover rounded-xl border border-slate-200 dark:border-white/10" />
                </button>
              ) : it.file_name ? (
                <div className="flex items-center gap-2 mb-3 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/5 rounded-lg px-3 py-2">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{it.file_name}</span>
                  {it.file_size != null && <span className="shrink-0">· {(it.file_size / (1024 * 1024)).toFixed(1)}MB</span>}
                </div>
              ) : null}

              <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap leading-relaxed mb-3">
                {snippet(it.content)}
              </p>

              {it.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {it.tags.slice(0, 5).map((t) => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      {t}
                    </span>
                  ))}
                </div>
              )}

              {usages.length > 0 && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">
                  📌 Usei em: {usagesLine(usages)}
                </p>
              )}

              <footer className="flex items-center justify-between text-xs text-slate-400">
                <div className="flex items-center gap-3">
                  <span>{formatDate(it.created_at)}</span>
                  {(it.metric_opens || it.metric_replies || it.metric_clicks) && (
                    <span className="text-slate-500 dark:text-slate-400">
                      {it.metric_opens ? `${it.metric_opens} opens · ` : ''}
                      {it.metric_replies ? `${it.metric_replies} respostas` : ''}
                      {it.metric_clicks ? `${it.metric_clicks} cliques` : ''}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setSelected(it)}
                    className="text-slate-500 hover:text-primary-600 underline-offset-2 hover:underline"
                  >
                    ver
                  </button>
                  <button
                    onClick={() => toggleTemplate(it.id, it.is_template)}
                    title={it.is_template ? 'Remover template' : 'Marcar como template'}
                    className="p-1 text-slate-400 hover:text-violet-500"
                  >
                    <Pin className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => navigator.clipboard.writeText(it.content)}
                    title="Copiar conteúdo"
                    className="p-1 text-slate-400 hover:text-primary-500"
                  >
                    <CopyIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => archive(it.id)}
                    title="Arquivar"
                    className="p-1 text-slate-400 hover:text-rose-500"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </footer>
            </article>
          );
        })}
      </div>

      {/* Add modal */}
      {addMode && (
        <AddPieceModal mode={addMode} onClose={() => setAddMode(null)} onSaved={load} />
      )}

      {/* Detail drawer */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-0 md:p-6"
          onClick={() => setSelected(null)}
        >
          <div
            className="bg-white dark:bg-slate-900 w-full md:max-w-2xl md:rounded-2xl rounded-t-2xl border border-slate-200 dark:border-white/10 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="sticky top-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/10 p-4 flex items-center justify-between">
              <div className="min-w-0">
                <span className="text-[10px] uppercase tracking-wide font-semibold text-slate-500">
                  {TYPE_LABELS[selected.type] || selected.type}
                  {selected.channel ? ` · ${selected.channel}` : ''}
                  {' · '}
                  {ORIGIN_LABELS[selected.origin as CreativeOrigin] || selected.origin}
                </span>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                  {selected.title || selected.subject || 'Sem título'}
                </h2>
              </div>
              <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-700 dark:hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </header>
            <div className="p-4 space-y-4">
              {selected.file_url && (selected.mime_type || '').startsWith('image/') && (
                 
                <img src={selected.file_url} alt={selected.title || 'Peça da biblioteca'} className="w-full max-h-96 object-contain rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20" />
              )}
              {selected.subject && selected.title && (
                <div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Assunto</div>
                  <div className="text-sm text-slate-900 dark:text-white">{selected.subject}</div>
                </div>
              )}
              <div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Conteúdo</div>
                <pre className="whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-100 font-sans leading-relaxed">{selected.content}</pre>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
                <div><strong className="text-slate-700 dark:text-slate-200">Criado:</strong> {formatDate(selected.created_at)}</div>
                <div className="flex items-center gap-2">
                  <strong className="text-slate-700 dark:text-slate-200">Estado:</strong>
                  <select
                    value={STATUS_OPTIONS.includes(selected.status as CreativeStatus) ? selected.status : ''}
                    onChange={(e) => { if (e.target.value) setStatus(selected.id, e.target.value as CreativeStatus); }}
                    className="px-2 py-1 text-xs rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/40 text-slate-900 dark:text-slate-100"
                  >
                    {!STATUS_OPTIONS.includes(selected.status as CreativeStatus) && (
                      <option value="">{STATUS_LABELS[selected.status as CreativeStatus] || selected.status}</option>
                    )}
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                    ))}
                  </select>
                </div>
                {selected.imovel_id && (
                  <div className="col-span-2">
                    <strong className="text-slate-700 dark:text-slate-200">Imóvel:</strong>{' '}
                    <a href={`/imoveis/${selected.imovel_id}`} className="text-primary-600 dark:text-primary-400 hover:underline inline-flex items-center gap-1">
                      <Home className="h-3 w-3" /> ver ficha do imóvel
                    </a>
                  </div>
                )}
                {selected.file_name && (
                  <div className="col-span-2 flex items-center gap-2">
                    <strong className="text-slate-700 dark:text-slate-200">Ficheiro:</strong>
                    <span className="truncate">{selected.file_name}</span>
                    {selected.file_url && (
                      <a
                        href={selected.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline shrink-0"
                      >
                        <Download className="h-3 w-3" /> descarregar
                      </a>
                    )}
                  </div>
                )}
                {selected.ai_model && (<div><strong className="text-slate-700 dark:text-slate-200">Modelo IA:</strong> {selected.ai_model}</div>)}
                {selected.ai_cost_usd != null && (<div><strong className="text-slate-700 dark:text-slate-200">Custo:</strong> ${selected.ai_cost_usd}</div>)}
              </div>

              {(() => {
                const usages = parseUsages(selected.usages);
                if (usages.length === 0) return null;
                return (
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">Onde usei</div>
                    <ul className="space-y-1">
                      {usages.map((u, i) => (
                        <li key={i} className="text-sm text-slate-700 dark:text-slate-200">
                          📌 {u.channel} · {formatUsageDate(u.used_on)}{u.note ? ` · ${u.note}` : ''}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })()}

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
                <Button size="sm" variant="outline" onClick={() => navigator.clipboard.writeText(selected.content)}>
                  <CopyIcon className="h-4 w-4 mr-1" /> Copiar
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggleTemplate(selected.id, selected.is_template)}>
                  <Pin className="h-4 w-4 mr-1" />
                  {selected.is_template ? 'Remover template' : 'Marcar template'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggleFav(selected.id, selected.is_favorite)}>
                  <Star className="h-4 w-4 mr-1" fill={selected.is_favorite ? 'currentColor' : 'none'} />
                  {selected.is_favorite ? 'Remover favorito' : 'Favoritar'}
                </Button>
                <Button size="sm" variant="outline" onClick={() => archive(selected.id)} className="ml-auto text-rose-600 hover:text-rose-700">
                  <Trash2 className="h-4 w-4 mr-1" /> Arquivar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CriativosPage;
