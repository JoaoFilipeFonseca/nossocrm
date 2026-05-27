'use client';

/**
 * WriteBuilder — modo "Escreve": descreve a automação, IA gera.
 *
 * Sprint 9, commit 2.
 *
 * Pedido literal do João (27 Mai 2026 noite):
 *   "uma terceira opção ainda mais simples — escrevo o que quero,
 *    a IA monta. Por exemplo: após lead entrar, esperar 3 min,
 *    mandar saudação, esperar 2 dias, lembrar para ligar..."
 *
 * Fluxo:
 *  1. Textarea grande para descrição em PT
 *  2. Botão "✨ Gerar automação" → POST /api/ai/automation-generate
 *  3. Preview do JSON gerado (lista compacta de passos)
 *  4. Botões "✅ Aplicar" (PATCH definition) ou "🔄 Refinar" (textarea adicional)
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAtomMeta } from '@/lib/automation-engine/catalog';

interface GeneratedNode {
  id: string;
  atom: string;
  position?: { x: number; y: number };
  config?: Record<string, unknown>;
}

interface GeneratedEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
}

interface Generated {
  name: string;
  icon: string;
  description: string;
  definition: { nodes: GeneratedNode[]; edges: GeneratedEdge[] };
  model_used?: string;
  fallback_used?: boolean;
}

export interface WriteBuilderProps {
  automationId: string;
}

const EXAMPLES = [
  'Quando entra um lead novo: esperar 3 minutos, mandar saudação no Telegram, esperar 2 dias, criar tarefa para ligar.',
  'Lead novo: pedir aprovação no Telegram para enviar mensagem; se aprovado mando a saudação; se rejeitado registo no log.',
  'Quando um deal mudar para "perdido": IA escreve mensagem de re-engagement, envia no Telegram, espera 30 dias, pede ao consultor para ligar.',
];

export function WriteBuilder({ automationId }: WriteBuilderProps) {
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [refine, setRefine] = useState('');
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState<Generated | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  async function generate() {
    if (!description.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/automation-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, refine: refine.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setGenerated(data as Generated);
      setRefine('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function apply() {
    if (!generated) return;
    setApplying(true);
    setError(null);
    try {
      const res = await fetch(`/api/automations/${automationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: generated.name,
          icon: generated.icon,
          description: generated.description,
          definition: generated.definition,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError((data as { message?: string }).message ?? `HTTP ${res.status}`);
        return;
      }
      router.refresh();
      setGenerated(null);
      setDescription('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-violet-200 bg-violet-50/40 p-4">
        <label className="block">
          <span className="text-sm font-medium text-slate-800">Escreve em português o que queres que a automação faça:</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={5}
            placeholder="Ex: quando entra um lead novo, esperar 3 minutos, mandar mensagem de boas-vindas no Telegram, esperar 2 dias e criar uma tarefa para ligar."
            className="mt-2 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        {!generated ? (
          <div className="flex flex-wrap gap-2 mt-3">
            {EXAMPLES.map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setDescription(ex)}
                className="text-[11px] text-violet-700 hover:text-violet-900 underline"
              >
                Exemplo {i + 1}
              </button>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between mt-3">
          <div className="text-[11px] text-slate-500">
            {generated ? `Gerado por ${generated.model_used}${generated.fallback_used ? ' (fallback)' : ''}` : 'A IA usa Gemini com fallback Anthropic.'}
          </div>
          <button
            type="button"
            onClick={generate}
            disabled={loading || !description.trim()}
            className="inline-flex items-center rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {loading ? 'A pensar...' : generated ? '🔄 Voltar a gerar' : '✨ Gerar automação'}
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-800 p-3 text-sm">
          ⚠ {error}
        </div>
      ) : null}

      {generated ? (
        <div className="rounded-lg border border-emerald-300 bg-white p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-start gap-2 min-w-0">
              <span className="text-2xl shrink-0">{generated.icon}</span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900 truncate">{generated.name}</h3>
                <p className="text-xs text-slate-500">{generated.description}</p>
              </div>
            </div>
          </div>

          <div className="text-xs text-slate-500 mb-2">
            {generated.definition.nodes.length} passos · {generated.definition.edges.length} ligações
          </div>

          <ol className="space-y-1.5">
            {generated.definition.nodes.map((n, i) => {
              const meta = getAtomMeta(n.atom);
              const cfgKeys = Object.keys(n.config ?? {});
              const cfgPreview = cfgKeys.length
                ? cfgKeys.map((k) => `${k}: ${String((n.config as Record<string, unknown>)[k]).slice(0, 60)}`).join(' · ')
                : 'sem config';
              return (
                <li key={n.id} className="flex items-start gap-2 text-xs">
                  <span className="inline-flex w-5 h-5 rounded-full bg-slate-100 items-center justify-center text-[10px] font-bold text-slate-600 shrink-0">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-800">{meta?.icon} {meta?.name ?? n.atom}</div>
                    <div className="text-slate-500 truncate" title={cfgPreview}>{cfgPreview}</div>
                  </div>
                </li>
              );
            })}
          </ol>

          {generated.definition.edges.some((e) => e.sourceHandle) ? (
            <div className="mt-3 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              Inclui ramificações (Se/Então ou Aprovação). Vai ver-se melhor no modo Visual.
            </div>
          ) : null}

          <details className="mt-3 text-[11px]">
            <summary className="cursor-pointer text-slate-500 hover:text-slate-700">Ver JSON gerado</summary>
            <pre className="mt-2 bg-slate-50 border border-slate-200 rounded p-2 overflow-auto max-h-64 text-[10px]">{JSON.stringify(generated.definition, null, 2)}</pre>
          </details>

          <div className="mt-4 pt-3 border-t border-slate-100">
            <label className="block">
              <span className="text-xs text-slate-600">Refinar (opcional): diz o que mudar</span>
              <textarea
                value={refine}
                onChange={(e) => setRefine(e.target.value)}
                rows={2}
                placeholder="Ex: muda o tempo de espera para 5 minutos, e em vez de criar tarefa, manda um lembrete no Telegram."
                className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-xs"
              />
            </label>
            <div className="flex justify-end gap-2 mt-2">
              <button
                type="button"
                onClick={generate}
                disabled={loading || !refine.trim()}
                className="text-xs rounded-md border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {loading ? 'A refinar...' : '🔄 Refinar'}
              </button>
              <button
                type="button"
                onClick={apply}
                disabled={applying}
                className="text-xs rounded-md bg-emerald-600 px-3 py-1.5 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {applying ? 'A aplicar...' : '✅ Aplicar à automação'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
