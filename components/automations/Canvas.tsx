'use client';

/**
 * Canvas — render React Flow editável de uma automation.definition
 *
 * Sprint 2.1, commit 2: drag persiste via PATCH com debounce.
 *
 * Recebe automationId e definition inicial. Mantém estado local de nodes/edges,
 * actualiza via onNodesChange/onEdgesChange (drag, selecção), e após 800ms
 * sem mais mudanças chama PATCH /api/automations/[id] com a nova definition.
 *
 * Mostra indicador "guardado / a guardar..." no top-left.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Position,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
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
  automationId: string;
  definition: { nodes: AutomationNodeIn[]; edges: AutomationEdgeIn[] };
  className?: string;
}

interface RFNodeData extends Record<string, unknown> {
  atom: string;
  config: Record<string, unknown>;
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

function makeRFNode(input: AutomationNodeIn, fallbackIndex: number): Node<RFNodeData> {
  const { icon, name } = atomLabel(input.atom);
  return {
    id: input.id,
    position: input.position ?? { x: fallbackIndex * 250, y: 0 },
    data: {
      atom: input.atom,
      config: input.config ?? {},
      label: (
        <div className="flex flex-col items-center gap-0.5 text-[11px] leading-tight">
          <span className="text-base">{icon}</span>
          <span className="font-medium text-slate-900">{name}</span>
          <span className="text-[10px] text-slate-500 font-mono">{input.atom}</span>
        </div>
      ),
    } as unknown as RFNodeData,
    className: `rounded-md border-2 px-3 py-2 shadow-sm ${categoryColor(input.atom)}`,
    type: 'default',
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  };
}

function makeRFEdge(e: AutomationEdgeIn): Edge {
  return { id: e.id, source: e.source, target: e.target, animated: true, style: { stroke: '#94a3b8' } };
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function Canvas({ automationId, definition, className }: CanvasProps) {
  const initialNodes = useMemo(() => (definition.nodes ?? []).map((n, i) => makeRFNode(n, i)), [definition]);
  const initialEdges = useMemo(() => (definition.edges ?? []).map((e) => makeRFEdge(e)), [definition]);

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedAt = useRef<number>(Date.now());

  // Serializa estado React Flow de volta para automation definition format
  const toDefinition = useCallback(() => {
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        atom: (n.data as RFNodeData)?.atom ?? 'unknown',
        position: n.position,
        config: (n.data as RFNodeData)?.config ?? {},
      })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
    };
  }, [nodes, edges]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveStatus('saving');
    saveTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/automations/${automationId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ definition: toDefinition() }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        lastSavedAt.current = Date.now();
        setSaveStatus('saved');
        // após 2s sem nova edição, volta a 'idle'
        setTimeout(() => {
          if (Date.now() - lastSavedAt.current >= 1900) setSaveStatus('idle');
        }, 2000);
      } catch {
        setSaveStatus('error');
      }
    }, 800);
  }, [automationId, toDefinition]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    if (changes.some((c) => c.type === 'position' && c.dragging === false)) {
      // só salva quando o drag termina, não durante o movimento
      scheduleSave();
    }
  }, [scheduleSave]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    if (changes.some((c) => c.type === 'remove')) scheduleSave();
  }, [scheduleSave]);

  // Cleanup timer
  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const statusBadge = (() => {
    switch (saveStatus) {
      case 'saving': return { text: '💾 A guardar...', color: 'text-amber-700 bg-amber-50 border-amber-200' };
      case 'saved': return { text: '✓ Guardado', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' };
      case 'error': return { text: '⚠ Erro a guardar', color: 'text-red-700 bg-red-50 border-red-200' };
      default: return null;
    }
  })();

  return (
    <div className={`relative ${className ?? 'h-[500px]'}`}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
      <div className="absolute top-2 left-2 z-10 flex items-center gap-2">
        <div className="text-[10px] text-slate-400 bg-white/80 rounded px-2 py-1 border border-slate-200">
          {nodes.length} nós · {edges.length} ligações · {ATOM_CATALOG.length} átomos
        </div>
        {statusBadge ? (
          <div className={`text-[10px] rounded px-2 py-1 border ${statusBadge.color}`}>{statusBadge.text}</div>
        ) : null}
      </div>
    </div>
  );
}
