'use client';

/**
 * LinearBuilder — vista linha-a-linha para construir automações.
 *
 * Sprint 4.0, commit 2.
 *
 * Pedido do João (norte estratégico): "uma linha onde tem uma caixa que escolho
 * o que quero, depois acrescentar linha, abre outra em baixo em que escolho
 * email, chamada, WhatsApp..." Vista alternativa ao canvas para fluxos lineares,
 * acessível a consultor sem skills técnicas.
 *
 * Lista de LinearStepRow (linhas). 1ª linha = trigger (filtrado por categoria).
 * Restantes = action/logic. Save automático debounce 800ms via PATCH.
 *
 * Detecta automaticamente se o fluxo tem ramificações (edges com sourceHandle).
 * Se sim, mostra banner e renderiza apenas leitura — fluxos com if/else só no
 * modo Visual.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ATOM_CATALOG, getAtomMeta } from '@/lib/automation-engine/catalog';
import { SchemaForm } from './SchemaForm';

interface NodeIn {
  id: string;
  atom: string;
  position?: { x: number; y: number };
  config?: Record<string, unknown>;
}
interface EdgeIn {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
}
interface Definition {
  nodes: NodeIn[];
  edges: EdgeIn[];
}

export interface LinearBuilderProps {
  automationId: string;
  definition: Definition;
}

function newId(): string {
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function categoryColor(atomId: string): string {
  if (atomId.startsWith('trigger.')) return 'border-l-emerald-500 bg-emerald-50/40';
  if (atomId.startsWith('action.')) return 'border-l-violet-500 bg-violet-50/40';
  if (atomId.startsWith('logic.')) return 'border-l-amber-500 bg-amber-50/40';
  return 'border-l-slate-400 bg-slate-50/40';
}

function defaultConfigFor(atomId: string): Record<string, unknown> {
  const meta = getAtomMeta(atomId);
  if (!meta) return {};
  const schema = meta.configSchema as { properties?: Record<string, { type?: string; minimum?: number; enum?: unknown[] }>; required?: string[] };
  const props = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const out: Record<string, unknown> = {};
  for (const key of required) {
    const def = props[key];
    if (!def) continue;
    switch (def.type) {
      case 'array': out[key] = []; break;
      case 'object': out[key] = {}; break;
      case 'integer':
      case 'number': out[key] = def.minimum ?? 1; break;
      case 'string': out[key] = def.enum && def.enum.length ? def.enum[0] : ''; break;
      default: out[key] = null;
    }
  }
  return out;
}

/** Converte lista linear de nodes em definition (encadeamento via edges sequenciais). */
function nodesToDefinition(steps: NodeIn[]): Definition {
  const nodes: NodeIn[] = steps.map((s, i) => ({
    id: s.id,
    atom: s.atom,
    position: s.position ?? { x: 80 + i * 220, y: 80 },
    config: s.config ?? {},
  }));
  const edges: EdgeIn[] = [];
  for (let i = 0; i < steps.length - 1; i += 1) {
    edges.push({ id: `e-${steps[i].id}-${steps[i + 1].id}`, source: steps[i].id, target: steps[i + 1].id });
  }
  return { nodes, edges };
}

/** Ordena nodes seguindo as edges (assume cadeia linear). Retorna null se tem ramificações. */
function definitionToLinearSteps(def: Definition): NodeIn[] | null {
  const nodes = def.nodes ?? [];
  const edges = def.edges ?? [];
  if (nodes.length === 0) return [];

  // Detecta ramificações (sourceHandle definido OU mais de 1 edge a sair do mesmo source)
  const branchHandles = edges.some((e) => e.sourceHandle === 'true' || e.sourceHandle === 'false');
  if (branchHandles) return null;
  const outDegree = new Map<string, number>();
  for (const e of edges) outDegree.set(e.source, (outDegree.get(e.source) ?? 0) + 1);
  if ([...outDegree.values()].some((c) => c > 1)) return null;

  // Encontra start (node sem target)
  const targets = new Set(edges.map((e) => e.target));
  const start = nodes.find((n) => !targets.has(n.id));
  if (!start) return nodes; // ciclo? Volta os nodes brutos

  const ordered: NodeIn[] = [];
  let current: NodeIn | undefined = start;
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    ordered.push(current);
    const nextEdge = edges.find((e) => e.source === current!.id);
    current = nextEdge ? nodes.find((n) => n.id === nextEdge.target) : undefined;
  }
  // adiciona órfãos no fim
  for (const n of nodes) if (!visited.has(n.id)) ordered.push(n);
  return ordered;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface StepRowProps {
  step: NodeIn;
  index: number;
  total: number;
  onChange: (next: NodeIn) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

function LinearStepRow({ step, index, total, onChange, onRemove, onMoveUp, onMoveDown }: StepRowProps) {
  const isFirst = index === 0;
  const meta = getAtomMeta(step.atom);

  const availableAtoms = ATOM_CATALOG.filter((a) =>
    isFirst ? a.category === 'trigger' : a.category !== 'trigger'
  );

  const setAtom = (atomId: string) => {
    onChange({ ...step, atom: atomId, config: defaultConfigFor(atomId) });
  };

  const setConfig = (next: Record<string, unknown>) => {
    onChange({ ...step, config: next });
  };

  return (
    <div className={`rounded-lg border border-slate-200 border-l-4 bg-white shadow-sm ${categoryColor(step.atom)}`}>
      <div className="flex items-start gap-3 p-3">
        {/* Número + reordenar */}
        <div className="flex flex-col items-center gap-1 shrink-0 pt-1">
          <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-600 text-xs font-bold flex items-center justify-center">
            {index + 1}
          </div>
          <div className="flex flex-col gap-0.5">
            <button type="button" onClick={onMoveUp} disabled={index === 0} className="text-slate-400 hover:text-slate-700 disabled:opacity-25 text-xs" title="Subir">▲</button>
            <button type="button" onClick={onMoveDown} disabled={index === total - 1} className="text-slate-400 hover:text-slate-700 disabled:opacity-25 text-xs" title="Descer">▼</button>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Header: dropdown átomo + apagar */}
          <div className="flex items-center gap-2">
            <span className="text-lg shrink-0">{meta?.icon ?? '❓'}</span>
            <select
              value={step.atom}
              onChange={(e) => setAtom(e.target.value)}
              className="flex-1 min-w-0 rounded border border-slate-300 px-2 py-1 text-sm font-medium bg-white"
            >
              <option value="" disabled>{isFirst ? '— escolhe um gatilho —' : '— escolhe uma acção —'}</option>
              {availableAtoms.map((a) => (
                <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={onRemove}
              className="text-red-500 hover:text-red-700 text-sm px-2"
              title="Apagar passo"
            >
              ✕
            </button>
          </div>

          {/* Descrição do átomo */}
          {meta ? (
            <p className="text-[11px] text-slate-500 pl-7">{meta.description}</p>
          ) : null}

          {/* Form de config */}
          {meta && Object.keys((meta.configSchema as { properties?: Record<string, unknown> }).properties ?? {}).length > 0 ? (
            <div className="pl-7 pt-1 border-t border-slate-100">
              <SchemaForm
                schema={meta.configSchema}
                values={step.config ?? {}}
                onChange={setConfig}
                showVarsHint={!isFirst}
              />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function LinearBuilder({ automationId, definition }: LinearBuilderProps) {
  const initialSteps = useMemo(() => definitionToLinearSteps(definition), [definition]);
  const isBranched = initialSteps === null;

  const [steps, setSteps] = useState<NodeIn[]>(initialSteps ?? []);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedAt = useRef<number>(Date.now());

  const scheduleSave = useCallback((nextSteps: NodeIn[]) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/automations/${automationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ definition: nodesToDefinition(nextSteps) }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        lastSavedAt.current = Date.now();
        setSaveStatus('saved');
        setTimeout(() => {
          if (Date.now() - lastSavedAt.current >= 1900) setSaveStatus('idle');
        }, 2000);
      } catch {
        setSaveStatus('error');
      }
    }, 800);
  }, [automationId]);

  useEffect(() => () => { if (saveTimer.current) clearTimeout(saveTimer.current); }, []);

  const updateStep = (index: number, next: NodeIn) => {
    const nextSteps = steps.map((s, i) => (i === index ? next : s));
    setSteps(nextSteps);
    scheduleSave(nextSteps);
  };

  const removeStep = (index: number) => {
    const ok = window.confirm(`Apagar o passo ${index + 1}?`);
    if (!ok) return;
    const nextSteps = steps.filter((_, i) => i !== index);
    setSteps(nextSteps);
    scheduleSave(nextSteps);
  };

  const moveStep = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= steps.length) return;
    const nextSteps = [...steps];
    [nextSteps[index], nextSteps[j]] = [nextSteps[j], nextSteps[index]];
    setSteps(nextSteps);
    scheduleSave(nextSteps);
  };

  const addStep = () => {
    const isFirst = steps.length === 0;
    const defaultAtom = isFirst ? 'trigger.event' : 'action.log';
    const newStep: NodeIn = {
      id: newId(),
      atom: defaultAtom,
      config: defaultConfigFor(defaultAtom),
    };
    const nextSteps = [...steps, newStep];
    setSteps(nextSteps);
    scheduleSave(nextSteps);
  };

  if (isBranched) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-5">
        <div className="text-amber-900 font-semibold mb-1">Este fluxo tem ramificações</div>
        <p className="text-sm text-amber-800">
          A automação inclui passos com decisões (Se / Então). O modo Linha só suporta fluxos sequenciais.
          Volta ao modo <strong>Visual</strong> para editar este fluxo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-500">
          Constrói a automação passo a passo. Cada linha é uma acção.
        </p>
        {saveStatus !== 'idle' ? (
          <span className={`text-[11px] rounded px-2 py-0.5 border ${
            saveStatus === 'saving' ? 'text-amber-700 bg-amber-50 border-amber-200' :
            saveStatus === 'saved' ? 'text-emerald-700 bg-emerald-50 border-emerald-200' :
            'text-red-700 bg-red-50 border-red-200'
          }`}>
            {saveStatus === 'saving' ? '💾 A guardar...' : saveStatus === 'saved' ? '✓ Guardado' : '⚠ Erro a guardar'}
          </span>
        ) : null}
      </div>

      {steps.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center">
          <p className="text-sm text-slate-500 mb-3">Sem passos ainda. Começa por um gatilho.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {steps.map((step, i) => (
            <LinearStepRow
              key={step.id}
              step={step}
              index={i}
              total={steps.length}
              onChange={(next) => updateStep(i, next)}
              onRemove={() => removeStep(i)}
              onMoveUp={() => moveStep(i, -1)}
              onMoveDown={() => moveStep(i, 1)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addStep}
        className="w-full rounded-lg border-2 border-dashed border-slate-300 py-3 text-sm font-medium text-slate-600 hover:border-violet-400 hover:text-violet-700 hover:bg-violet-50/30 transition"
      >
        + Adicionar passo
      </button>
    </div>
  );
}
