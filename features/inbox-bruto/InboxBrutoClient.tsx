'use client';

import { useEffect, useState } from 'react';
import { Inbox, Sparkles, Home, Search, Lightbulb, TrendingUp, Handshake, Target, Bolt, Clipboard, Wand, Loader2 } from 'lucide-react';

type RawIntel = {
  id: string;
  intent: string;
  ownership: string;
  confidence_overall: number | null;
  property: any;
  contact: any;
  market_event: any;
  partner: any;
  notes: string | null;
  requires_review: boolean;
  status: string;
  created_at: string;
  source_attribution: string | null;
};

const INTENT_META: Record<string, { label: string; icon: any; bg: string; fg: string }> = {
  angariacao: { label: 'Angariação', icon: Home, bg: '#E6F1FB', fg: '#0C447C' },
  procura: { label: 'Procura', icon: Search, bg: '#E1F5EE', fg: '#085041' },
  fsbo_tip: { label: 'FSBO tip', icon: Lightbulb, bg: '#FAEEDA', fg: '#633806' },
  parceiro: { label: 'Parceiro', icon: Handshake, bg: '#FBEAF0', fg: '#4B1528' },
  evento_mercado: { label: 'Evento de mercado', icon: TrendingUp, bg: '#EEEDFE', fg: '#3C3489' },
  concorrente: { label: 'Concorrente', icon: Target, bg: '#F1EFE8', fg: '#2C2C2A' },
  irrelevante: { label: 'Irrelevante', icon: Target, bg: '#F1EFE8', fg: '#888780' }
};

const OWNERSHIP_META: Record<string, { label: string; bg: string; fg: string }> = {
  minha: { label: 'Minha', bg: '#E1F5EE', fg: '#0F6E56' },
  colega: { label: 'Colega', bg: '#FBEAF0', fg: '#72243E' },
  externa: { label: 'Externa', bg: '#FAECE7', fg: '#712B13' }
};

const FILTERS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'angariacao', label: 'Angariações' },
  { id: 'procura', label: 'Procuras' },
  { id: 'fsbo_tip', label: 'FSBO tips' },
  { id: 'parceiro', label: 'Parceiros' },
  { id: 'evento_mercado', label: 'Mercado' }
];

export function InboxBrutoClient() {
  const [text, setText] = useState('');
  const [items, setItems] = useState<RawIntel[]>([]);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [filter, setFilter] = useState('all');
  const [processing, setProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function load() {
    const url = filter === 'all' ? '/api/inbox-raw/list' : '/api/inbox-raw/list?intent=' + filter;
    const r = await fetch(url, { cache: 'no-store' });
    const j = await r.json();
    setItems(j.items || []);
    setSummary(j.summary || {});
  }

  useEffect(() => { load(); }, [filter]);

  async function process() {
    if (!text.trim() || processing) return;
    setProcessing(true);
    setFeedback(null);
    try {
      const r = await fetch('/api/inbox-raw/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const j = await r.json();
      if (!r.ok) {
        setFeedback('Erro: ' + (j.error || 'desconhecido'));
      } else {
        setFeedback(\`${j.created} novos registos criados\`);
        setText('');
        await load();
      }
    } catch (e: any) {
      setFeedback('Erro: ' + String(e.message || e));
    }
    setProcessing(false);
    setTimeout(() => setFeedback(null), 4000);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2 text-slate-900 dark:text-white">
            <Inbox size={26} className="text-blue-600" /> Inbox Bruto
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Cola texto solto. A IA extrai imóveis, procuras e oportunidades.</p>
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {Object.values(summary).reduce((a, b) => a + b, 0)} processados
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Angariações', value: summary.angariacao || 0 },
          { label: 'Procuras', value: summary.procura || 0 },
          { label: 'FSBO tips', value: summary.fsbo_tip || 0 },
          { label: 'Mercado', value: summary.evento_mercado || 0 }
        ].map((kpi, i) => (
          <div key={i} className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3">
            <div className="text-xs text-slate-500 dark:text-slate-400">{kpi.label}</div>
            <div className="text-xl font-semibold text-slate-900 dark:text-white">{kpi.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 mb-6">
        <label className="text-xs text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-1">
          <Clipboard size={14} /> Cola texto (WhatsApp, Idealista, notas, qualquer texto)
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="w-full min-h-[110px] font-mono text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 resize-y text-slate-900 dark:text-white"
          placeholder="Sandra · T2 Boavista 320k, varanda, garagem... Mariana 911234567"
        />
        <div className="flex justify-between items-center mt-3">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <Sparkles size={13} /> Gemini 2.5 Flash · ~€0.0003 por mensagem
          </span>
          <button
            onClick={process}
            disabled={processing || !text.trim()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg flex items-center gap-2"
          >
            {processing ? <><Loader2 size={14} className="animate-spin" /> A processar...</> : <><Wand size={14} /> Processar</>}
          </button>
        </div>
        {feedback && <div className="mt-2 text-xs text-blue-600 dark:text-blue-400">{feedback}</div>}
      </div>

      <div className="flex gap-2 items-center mb-3">
        <span className="text-sm text-slate-500 dark:text-slate-400">Filtrar:</span>
        {FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={\`px-3 py-1 text-xs rounded-full border transition ${filter === f.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700' : 'bg-transparent text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'}\`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {items.length === 0 && (
          <div className="text-center py-10 text-sm text-slate-500 dark:text-slate-400">
            Sem registos. Cola texto acima e carrega Processar.
          </div>
        )}
        {items.map(r => {
          const im = INTENT_META[r.intent] || INTENT_META.irrelevante;
          const om = OWNERSHIP_META[r.ownership] || OWNERSHIP_META.externa;
          const IconI = im.icon;
          return (
            <div key={r.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
              <div className="flex flex-wrap gap-2 mb-2">
                <span className="text-[11px] px-2 py-1 rounded-full font-medium inline-flex items-center gap-1" style={{ background: im.bg, color: im.fg }}>
                  <IconI size={12} /> {im.label}
                </span>
                <span className="text-[11px] px-2 py-1 rounded-full font-medium" style={{ background: om.bg, color: om.fg }}>
                  {om.label}
                </span>
                {r.requires_review && (
                  <span className="text-[11px] px-2 py-1 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-300 font-medium">
                    Precisa revisão
                  </span>
                )}
                {r.confidence_overall != null && (
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-auto">{r.confidence_overall}%</span>
                )}
              </div>
              <div className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                {titleFor(r)}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {r.notes || subtitleFor(r)}
              </div>
              {r.contact && (
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 flex gap-3">
                  {r.contact.nome && <span>{r.contact.nome} {r.contact.apelido || ''}</span>}
                  {r.contact.telefone && <span>·  {r.contact.telefone}</span>}
                  {r.contact.agencia && <span>·  {r.contact.agencia}</span>}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function titleFor(r: RawIntel): string {
  if (r.intent === 'angariacao' && r.property) {
    const p = r.property;
    const parts = [p.tipologia, p.freguesia || p.zona, p.preco_eur ? new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(p.preco_eur) : null].filter(Boolean);
    return parts.join(' · ') || 'Imóvel';
  }
  if (r.intent === 'procura' && r.contact) {
    return 'Cliente ' + (r.contact.nome || 'sem nome') + (r.property?.tipologia ? ' · ' + r.property.tipologia : '') + (r.property?.zona ? ' ' + r.property.zona : '');
  }
  if (r.intent === 'fsbo_tip') {
    return 'FSBO: ' + (r.property?.tipologia || '') + ' ' + (r.property?.zona || r.property?.freguesia || '');
  }
  if (r.intent === 'parceiro') {
    return (r.contact?.nome || 'Parceiro') + (r.partner?.role ? ' · ' + r.partner.role : '');
  }
  if (r.intent === 'evento_mercado') {
    return r.market_event?.descricao || 'Evento de mercado';
  }
  return r.notes || 'Registo';
}

function subtitleFor(r: RawIntel): string {
  if (r.market_event?.impacto) return r.market_event.impacto;
  if (r.property?.caracteristicas?.length) return r.property.caracteristicas.join(' · ');
  return '';
}
