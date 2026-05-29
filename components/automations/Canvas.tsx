'use client';

/**
 * Canvas — render React Flow editável de uma automation.definition.
 *
 * Sprint 2.1: drag persiste via PATCH com debounce, ligações editáveis, delete key.
 * Sprint 2.2: aceita drop de átomos da Palette (commit 2).
 *
 * Estrutura: <Canvas> exporta um wrapper com <ReactFlowProvider> à volta do
 * <CanvasInner> que pode então usar useReactFlow() para converter coords do
 * evento de drop em coordenadas do canvas (screenToFlowPosition).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  Position,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  useReactFlow,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { getAtomMeta, ATOM_CATALOG } from '@/lib/automation-engine/catalog';
import { ConditionNode } from './nodes/ConditionNode';
import { SwitchNode } from './nodes/SwitchNode';
import { FilterNode } from './nodes/FilterNode';
import { LoopNode } from './nodes/LoopNode';
import { NodeConfigPanel } from './NodeConfigPanel';

const NODE_TYPES = {
  'logic.condition': ConditionNode,
  'logic.switch': SwitchNode,
  'logic.filter': FilterNode,
  'logic.loop': LoopNode,
} as const;

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
  sourceHandle?: string | null;
  targetHandle?: string | null;
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

function nodeLabel(atomId: string) {
  const { icon, name } = atomLabel(atomId);
  return (
    <div className="flex flex-col items-center gap-0.5 text-[11px] leading-tight">
      <span className="text-base">{icon}</span>
      <span className="font-medium text-slate-900">{name}</span>
      <span className="text-[10px] text-slate-500 font-mono">{atomId}</span>
    </div>
  );
}

function nodeTypeFor(atomId: string): string {
  if (atomId === 'logic.condition') return 'logic.condition';
  if (atomId === 'logic.switch') return 'logic.switch';
  if (atomId === 'logic.filter') return 'logic.filter';
  if (atomId === 'logic.loop') return 'logic.loop';
  return 'default';
}

function makeRFNode(input: AutomationNodeIn, fallbackIndex: number): Node<RFNodeData> {
  const isCustom = nodeTypeFor(input.atom) !== 'default';
  return {
    id: input.id,
    position: input.position ?? { x: fallbackIndex * 250, y: 0 },
    data: {
      atom: input.atom,
      config: input.config ?? {},
      label: isCustom ? undefined : nodeLabel(input.atom),
    } as unknown as RFNodeData,
    className: isCustom ? undefined : `rounded-md border-2 px-3 py-2 shadow-sm ${categoryColor(input.atom)}`,
    type: nodeTypeFor(input.atom),
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  };
}

function edgeStyleFor(sourceHandle?: string | null): { stroke: string; label?: string } {
  if (!sourceHandle) return { stroke: '#94a3b8' };
  if (sourceHandle === 'true') return { stroke: '#10b981', label: 'Sim' };
  if (sourceHandle === 'false') return { stroke: '#ef4444', label: 'Não' };
  if (sourceHandle === 'pass') return { stroke: '#10b981', label: 'passa' };
  if (sourceHandle === 'stop') return { stroke: '#ef4444', label: 'pára' };
  if (sourceHandle === 'default') return { stroke: '#64748b', label: 'default' };
  if (sourceHandle === 'approved') return { stroke: '#10b981', label: 'aprovado' };
  if (sourceHandle === 'rejected') return { stroke: '#ef4444', label: 'rejeitado' };
  if (sourceHandle === 'edited') return { stroke: '#f59e0b', label: 'editado' };
  if (sourceHandle === 'timeout') return { stroke: '#64748b', label: 'timeout' };
  if (sourceHandle === 'event') return { stroke: '#10b981', label: 'evento' };
  if (sourceHandle === 'loop_body') return { stroke: '#a855f7', label: 'corpo' };
  if (sourceHandle === 'loop_done') return { stroke: '#10b981', label: 'concluído' };
  if (sourceHandle.startsWith('case_')) {
    const palette = ['#10b981', '#3b82f6', '#a855f7', '#ec4899', '#f59e0b', '#06b6d4', '#84cc16', '#f97316'];
    const idx = parseInt(sourceHandle.slice(5), 10);
    return { stroke: palette[Number.isFinite(idx) ? idx % palette.length : 0], label: sourceHandle };
  }
  return { stroke: '#94a3b8', label: sourceHandle };
}

function makeRFEdge(e: AutomationEdgeIn): Edge {
  const { stroke, label } = edgeStyleFor(e.sourceHandle);
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
    label,
    labelStyle: { fontSize: 10, fontWeight: 700, fill: stroke },
    labelBgStyle: { fill: '#ffffff' },
    labelBgPadding: [2, 4],
    animated: true,
    style: { stroke, strokeWidth: e.sourceHandle ? 2 : 1.5 },
  };
}

// Constroi config default a partir do configSchema (JSON Schema simplificado).
// Para já: array → [], object → {}, string → '', integer → minimum ?? 0.
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
      case 'number': out[key] = def.minimum ?? 0; break;
      case 'string': out[key] = def.enum && def.enum.length ? def.enum[0] : ''; break;
      default: out[key] = null;
    }
  }
  return out;
}

function newNodeId(): string {
  return `n-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function CanvasInner({ automationId, definition, className }: CanvasProps) {
  const initialNodes = useMemo(() => (definition.nodes ?? []).map((n, i) => makeRFNode(n, i)), [definition]);
  const initialEdges = useMemo(() => (definition.edges ?? []).map((e) => makeRFEdge(e)), [definition]);

  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [fullscreen, setFullscreen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedAt = useRef<number>(Date.now());
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition, getNodes, getEdges, setNodes: rfSetNodes, setEdges: rfSetEdges } = useReactFlow();

  // ESC sai do fullscreen
  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  const toDefinition = useCallback(() => {
    return {
      nodes: nodes.map((n) => ({
        id: n.id,
        atom: (n.data as RFNodeData)?.atom ?? 'unknown',
        position: n.position,
        config: (n.data as RFNodeData)?.config ?? {},
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        ...(e.sourceHandle ? { sourceHandle: e.sourceHandle } : {}),
        ...(e.targetHandle ? { targetHandle: e.targetHandle } : {}),
      })),
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
    const removed = changes.filter((c) => c.type === 'remove').map((c) => (c as { id: string }).id);
    if (removed.length && selectedNodeId && removed.includes(selectedNodeId)) {
      setSelectedNodeId(null);
    }
    if (changes.some((c) => (c.type === 'position' && c.dragging === false) || c.type === 'remove')) {
      scheduleSave();
    }
  }, [scheduleSave, selectedNodeId]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    if (changes.some((c) => c.type === 'remove')) scheduleSave();
  }, [scheduleSave]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => {
      const id = `e-${connection.source}-${connection.target}-${connection.sourceHandle ?? 'def'}-${Date.now()}`;
      const { stroke, label } = edgeStyleFor(connection.sourceHandle);
      return addEdge({
        ...connection,
        id,
        animated: true,
        label,
        labelStyle: { fontSize: 10, fontWeight: 700, fill: stroke },
        labelBgStyle: { fill: '#ffffff' },
        labelBgPadding: [2, 4],
        style: { stroke, strokeWidth: connection.sourceHandle ? 2 : 1.5 },
      }, eds);
    });
    scheduleSave();
  }, [scheduleSave]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setMobilePanelOpen(true);
    }
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, []);

  const updateSelectedConfig = useCallback((nextConfig: Record<string, unknown>) => {
    if (!selectedNodeId) return;
    setNodes((nds) => nds.map((n) => {
      if (n.id !== selectedNodeId) return n;
      const data = n.data as RFNodeData;
      return { ...n, data: { ...data, config: nextConfig } as unknown as RFNodeData };
    }));
    scheduleSave();
  }, [selectedNodeId, scheduleSave]);

  const duplicateSelected = useCallback(() => {
    if (!selectedNodeId) return;
    const src = getNodes().find((n) => n.id === selectedNodeId);
    if (!src) return;
    const newId = newNodeId();
    const clone: Node = {
      ...src,
      id: newId,
      position: { x: (src.position?.x ?? 0) + 40, y: (src.position?.y ?? 0) + 40 },
      selected: false,
    };
    setNodes((nds) => nds.concat(clone));
    setSelectedNodeId(newId);
    scheduleSave();
  }, [selectedNodeId, getNodes, scheduleSave]);

  const deleteOne = useCallback((id: string) => {
    rfSetNodes((nds) => nds.filter((n) => n.id !== id));
    rfSetEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
    if (selectedNodeId === id) setSelectedNodeId(null);
    scheduleSave();
  }, [rfSetNodes, rfSetEdges, selectedNodeId, scheduleSave]);

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const deleteSelected = useCallback(() => {
    const selectedNodes = getNodes().filter((n) => n.selected);
    const selectedEdges = getEdges().filter((e) => e.selected);
    if (selectedNodes.length === 0 && selectedEdges.length === 0) {
      // sem selecção: avisa
      alert('Clica primeiro num nó ou ligação para o seleccionar (fica com borda mais escura), depois carrega aqui ou em Delete/Backspace.');
      return;
    }
    const nodeIds = new Set(selectedNodes.map((n) => n.id));
    rfSetNodes((nds) => nds.filter((n) => !n.selected));
    rfSetEdges((eds) => eds.filter((e) => !e.selected && !nodeIds.has(e.source) && !nodeIds.has(e.target)));
    scheduleSave();
  }, [getNodes, getEdges, rfSetNodes, rfSetEdges, scheduleSave]);

  const onDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const atomId = event.dataTransfer.getData('application/reactflow');
    if (!atomId) return;
    if (!getAtomMeta(atomId)) return;

    const position = screenToFlowPosition({ x: event.clientX, y: event.clientY });
    const isCustom = nodeTypeFor(atomId) !== 'default';
    const newNode: Node<RFNodeData> = {
      id: newNodeId(),
      position,
      data: {
        atom: atomId,
        config: defaultConfigFor(atomId),
        label: isCustom ? undefined : nodeLabel(atomId),
      } as unknown as RFNodeData,
      className: isCustom ? undefined : `rounded-md border-2 px-3 py-2 shadow-sm ${categoryColor(atomId)}`,
      type: nodeTypeFor(atomId),
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };
    setNodes((nds) => nds.concat(newNode));
    scheduleSave();
  }, [screenToFlowPosition, scheduleSave]);

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

  const hasNodesNoEdges = nodes.length >= 2 && edges.length === 0;

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null;
  const selectedAtom = selectedNode ? (selectedNode.data as RFNodeData).atom : null;
  const selectedConfig = selectedNode ? ((selectedNode.data as RFNodeData).config ?? {}) : {};

  return (
    <div className={fullscreen
      ? 'fixed inset-0 z-50 bg-white flex'
      : `flex ${className ?? 'h-[500px]'}`}>
      <div
        ref={wrapperRef}
        className="relative flex-1 min-w-0"
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
      {/* CSS scoped: aumenta handles default React Flow para serem mais visiveis */}
      <style jsx global>{`
        .react-flow__handle {
          width: 12px !important;
          height: 12px !important;
          background: #94a3b8 !important;
          border: 2px solid #fff !important;
        }
        .react-flow__handle:hover {
          background: #6366f1 !important;
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        deleteKeyCode={['Backspace', 'Delete']}
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

      <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={deleteSelected}
          className="text-[11px] bg-white/95 rounded-md px-2.5 py-1 border border-red-200 text-red-700 shadow-sm hover:bg-red-50"
          title="Apaga o nó ou ligação seleccionada (também funciona com Delete / Backspace)"
        >
          🗑 Apagar selecção
        </button>
        <button
          type="button"
          onClick={() => setFullscreen((v) => !v)}
          className="text-[11px] bg-white/95 rounded-md px-2.5 py-1 border border-slate-200 shadow-sm hover:bg-slate-50"
          title={fullscreen ? 'Sair do ecrã cheio (ESC)' : 'Ecrã cheio'}
        >
          {fullscreen ? '✕ Sair' : '⛶ Ecrã cheio'}
        </button>
      </div>

      {hasNodesNoEdges ? (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-10 max-w-md text-center bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 shadow">
          <div className="text-xs font-medium text-amber-900">Os nós ainda não estão ligados</div>
          <div className="text-[11px] text-amber-700 mt-0.5">
            Passa o rato em cima de um nó. Aparece um pontinho à direita: arrasta-o até ao pontinho da esquerda do próximo nó.
          </div>
        </div>
      ) : null}
      {nodes.length === 0 ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="text-center text-slate-500 bg-white/90 border border-dashed border-slate-300 rounded-lg px-6 py-5 max-w-sm">
            <div className="text-2xl mb-1">👈</div>
            <div className="text-sm font-medium text-slate-700">Canvas vazio</div>
            <div className="text-xs mt-1">Arrasta um átomo da palette à esquerda para começar.</div>
          </div>
        </div>
      ) : null}
      </div>
      <NodeConfigPanel
        selectedNodeId={selectedNodeId}
        selectedAtomId={selectedAtom}
        config={selectedConfig as Record<string, unknown>}
        onConfigChange={updateSelectedConfig}
        onDuplicate={selectedNodeId ? duplicateSelected : undefined}
        onDelete={selectedNodeId ? () => deleteOne(selectedNodeId) : undefined}
        mobileOpen={mobilePanelOpen && selectedNodeId !== null}
        onMobileClose={() => setMobilePanelOpen(false)}
      />
    </div>
  );
}

export function Canvas(props: CanvasProps) {
  return (
    <ReactFlowProvider>
      <CanvasInner {...props} />
    </ReactFlowProvider>
  );
}
