'use client';

/**
 * Canvas — render React Flow de uma automation.definition
 *
 * Sprint 2.1, commit 1 de 3 (read-only por agora).
 *
 * Recebe definition já desserializada. Mostra nodes/edges como gráfico
 * interactivo (drag livre não persiste neste commit; o save vem no c2 com
 * o endpoint PATCH).
 *
 * Os nodes da máquina (atom = 'trigger.event' / 'action.X' / 'logic.X') são
 * renderizados com label = "icone nome", obtido a partir do registry da
 * lib/automation-engine. Sem registry expõe o atom_id raw.
 */

import { useMemo } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getAtomMeta, ATOM_CATALOG } from '@/lib/automation-engine/catalog';

interface AutomationNodeIn {
  id: string;
  atom: string;
  position?: { x: number; y: number };
  config?: Record<string, unknown>;
  label?: string;
}

interface AutomationEdgeIn {
  id: string;
  source: string;
  target: string;
}

export interface CanvasProps {
  definition: {
    nodes: AutomationNodeIn[];
    edges: AutomationEdgeIn[];
  };
  className?: string;
}

function atomLabel(atomId: string): { icon: string; name: string } {
  const a = getAtomMeta(atomId);
  if (a) return { icon: a.icon, name: a.name };
  return { icon: '❓', name: atomId };
}

function categoryColor(atomId: string): string {
  if (atomId.startsWith('trigger.')) return 'border-emerald-400 bg-emerald-50';
  if (atomId.startsWith('action.')) return 'border-violet-400 bg-violet-50';
  if (atomId.startsWith('logic.')) return 'border-amber-400 bg-amber-50';
  if (atomId.startsWith('data.')) return 'border-blue-400 bg-blue-50';
  if (atomId.startsWith('observability.')) return 'border-slate-400 bg-slate-50';
  return 'border-slate-300 bg-white';
}

export function Canvas({ definition, className }: CanvasProps) {
  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = (definition.nodes ?? []).map((n, i) => {
      const { icon, name } = atomLabel(n.atom);
      return {
        id: n.id,
        position: n.position ?? { x: i * 250, y: 0 },
        data: {
          label: (
            <div className="flex flex-col items-center gap-0.5 text-[11px] leading-tight">
              <span className="text-base">{icon}</span>
              <span className="font-medium text-slate-900">{name}</span>
              <span className="text-[10px] text-slate-500 font-mono">{n.atom}</span>
            </div>
          ),
        },
        className: `rounded-md border-2 px-3 py-2 shadow-sm ${categoryColor(n.atom)}`,
        type: 'default',
        // No Sprint 2.1 c1: source e target estão sempre, no c3 ajustamos por category
        sourcePosition: 'right' as const,
        targetPosition: 'left' as const,
      } as Node;
    });

    const edges: Edge[] = (definition.edges ?? []).map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: true,
      style: { stroke: '#94a3b8' },
    }));

    return { nodes, edges };
  }, [definition]);

  return (
    <div className={`relative ${className ?? 'h-[500px]'}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable
        nodesConnectable={false}
        elementsSelectable
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="#e2e8f0" />
        <Controls position="bottom-right" showInteractive={false} />
        <MiniMap nodeStrokeWidth={3} pannable />
      </ReactFlow>
      <div className="absolute top-2 left-2 z-10 text-[10px] text-slate-400 bg-white/80 rounded px-2 py-1 border border-slate-200">
        {nodes.length} nós · {edges.length} ligações · {ATOM_CATALOG.length} átomos no catálogo
      </div>
    </div>
  );
}
