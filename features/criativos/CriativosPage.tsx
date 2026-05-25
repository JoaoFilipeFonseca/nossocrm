'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Archive, Star, Search, Filter, X, Mail, MessageCircle, Smartphone, Megaphone, FileText, Image as ImageIcon, FileCheck2, BookOpen, Pin, Trash2, Copy as CopyIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

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

const TYPE_LABELS: Record<string, string> = {
  email: 'Email',
  whatsapp: 'WhatsApp',
  sms: 'SMS',
  social_post: 'Post Social',
  carousel: 'Carrossel',
  story: 'Story',
  ad_copy: 'Anúncio',
  blog_article: 'Blog',
  imovel_description: 'Descrição de Imóvel',
  sales_script: 'Script de Venda',
  briefing: 'Briefing',
  swot: 'SWOT',
  proposal: 'Proposta',
  pdf: 'PDF',
  banner: 'Banner',
};

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string; size?: number }>> = {
  email: Mail,
  whatsapp: MessageCircle,
  sms: Smartphone,
  social_post: Megaphone,
  carousel: ImageIcon,
  story: ImageIcon,
  ad_copy: Megaphone,
  blog_article: BookOpen,
  imovel_description: FileText,
  sales_script: FileCheck2,
  briefing: FileText,
  swot: FileText,
  proposal: FileCheck2,
  pdf: FileText,
  banner: ImageIcon,
};

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));
  } catch {
    return iso;
  }
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
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [templatesOnly, setTemplatesOnly] = useState(false);
  const [selected, setSelected] = useState<Creative | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      typeFilter.forEach((t) => params.append('type', t));
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
  }, [typeFilter.join(','), favoritesOnly, templatesOnly]);

  const filtered = items;

  const allTypes = useMemo(() => Array.from(new Set(items.map((i) => i.type))).sort(), [items]);
  const typesToOffer = allTypes.length > 0 ? allTypes : ['email', 'whatsapp', 'social_post', 'ad_copy', 'blog_article'];

  const toggleFav = async (id: string, current: boolean) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, is_favorite: !current } : it)));
    await fetch(`/api/criativos/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ is_favorite: !current }),
    });
  };

  const toggleTemplate = async (id: string, current: boolean) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, is_template: !current } : it)));
    await fetch(`/api/criativos/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ is_template: !current }),
    });
  };

  const archive = async (id: string) => {
    if (!confirm('Arquivar este criativo? Pode ser recuperado mais tarde.')) return;
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
            Criativos
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Arquivo perpétuo de tudo o que cria: emails, WhatsApp, posts, anúncios, blog, propostas. Marque favoritos e templates para reutilizar.
          </p>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {loading ? 'A carregar…' : `${filtered.length} ${filtered.length === 1 ? 'criativo' : 'criativos'}`}
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
              placeholder="Pesquisar em título, assunto e conteúdo… (Enter)"
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
          {(typeFilter.length > 0 || favoritesOnly || templatesOnly || search) && (
            <button
              onClick={() => { setTypeFilter([]); setFavoritesOnly(false); setTemplatesOnly(false); setSearch(''); load(); }}
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
            Ainda não tem criativos arquivados.
          </p>
          <p className="text-xs text-slate-400 mt-1">
            Quando os geradores de IA começarem a auto-arquivar, vão aparecer aqui.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((it) => {
          const Icon = TYPE_ICONS[it.type] || FileText;
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
              <div className="grid grid-cols-2 gap-4 text-xs text-slate-500 dark:text-slate-400">
                <div><strong className="text-slate-700 dark:text-slate-200">Criado:</strong> {formatDate(selected.created_at)}</div>
                <div><strong className="text-slate-700 dark:text-slate-200">Estado:</strong> {selected.status}</div>
                {selected.ai_model && (<div><strong className="text-slate-700 dark:text-slate-200">Modelo IA:</strong> {selected.ai_model}</div>)}
                {selected.ai_cost_usd != null && (<div><strong className="text-slate-700 dark:text-slate-200">Custo:</strong> ${selected.ai_cost_usd}</div>)}
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-white/10">
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
