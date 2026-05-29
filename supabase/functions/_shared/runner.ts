// ============================================================================
// runner.ts — runner puro do grafo de automações (partilhado Deno + vitest)
// ============================================================================
// Orquestra a travessia do grafo de uma automação. NÃO faz I/O: toda a
// execução de átomos, resolução de templates e persistência é injectada via
// `RunnerDeps`. Por isso este módulo:
//   - NÃO importa `npm:` nem usa globais Deno/fetch/crypto;
//   - é determinístico (sem Date.now()/Math.random());
//   - corre tal e qual em Deno (edge function) e em vitest/node (testes).
//
// T1 (este commit): paridade com o walk linear de cursor único anterior.
// Frames/loops/fan-out ficam preparados na estrutura mas só entram em T2/T3.
// ============================================================================

// ----------------------------------------------------------------------------
// Tipos do grafo (espelham lib/automation-engine/types.ts, mas locais para
// manter o módulo sem dependências de alias @/).
// ----------------------------------------------------------------------------
export interface AutomationNode {
  id: string;
  atom: string;
  position?: { x: number; y: number };
  config: Record<string, unknown>;
  label?: string;
}

export interface AutomationEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface AutomationDefinition {
  nodes: AutomationNode[];
  edges: AutomationEdge[];
}

// Saída de um átomo. As chaves `_*` são sinais de controlo lidos pelo runner.
export type AtomOutput = Record<string, unknown> & {
  _branch_taken?: string;
  _suspend?: boolean;
  _resumeAt?: string;
  _approval_token?: string;
  _halt?: boolean;
};

// ----------------------------------------------------------------------------
// Estado do runner (preparado para multi-frame em T2)
// ----------------------------------------------------------------------------
export interface LoopFrame {
  loopNodeId: string;
  items: unknown[];
  index: number;
  bodyEntryId: string;
}

export interface Frame {
  frameId: string;
  nodeId: string;
  loopStack: LoopFrame[];
}

export interface RunnerState {
  // Outputs acumulados por nó: { [nodeId]: { output } } (formato legacy mantido).
  variables: Record<string, { output: unknown }>;
  frontier: Frame[];
  joins: Record<string, { arrived: string[] }>;
  visited: string[];
  iterationCount: number;
}

// ----------------------------------------------------------------------------
// Dependências injectadas pelo adaptador (edge function)
// ----------------------------------------------------------------------------
export interface RunnerDeps {
  // Contexto base do template: { contact, deal, imovel, trigger } carregado uma vez.
  baseContext: Record<string, unknown>;
  // Executa um nó: resolve config, persiste o node_execution e devolve o output.
  // Lança em caso de erro do átomo (incluindo átomo desconhecido).
  runNode: (node: AutomationNode, vars: Record<string, unknown>) => Promise<AtomOutput>;
}

export type RunResult =
  | { kind: 'done' }
  | { kind: 'suspended'; suspendNodeId: string; resumeAt: string; approvalToken?: string }
  | { kind: 'error'; nodeId: string; message: string };

export interface RunOutcome {
  result: RunResult;
  state: RunnerState;
}

// Tecto de segurança de nós executados por invocação (substitui o antigo count<50).
export const SAFETY_CAP = 50;
// Limite de átomos a correr em simultâneo num tick de fan-out.
export const CONCURRENCY_CAP = 5;

// ----------------------------------------------------------------------------
// Helpers de grafo (puros)
// ----------------------------------------------------------------------------
export function nodeById(def: AutomationDefinition, id: string): AutomationNode | null {
  return def.nodes.find((n) => n.id === id) ?? null;
}

export function inEdges(def: AutomationDefinition, nodeId: string): AutomationEdge[] {
  return def.edges.filter((e) => e.target === nodeId);
}

/** Nó inicial: o que não é alvo de nenhuma edge. */
export function findStartNode(def: AutomationDefinition): AutomationNode | null {
  const targets = new Set(def.edges.map((e) => e.target));
  return def.nodes.find((n) => !targets.has(n.id)) ?? null;
}

/**
 * Próximo nó a seguir a partir de `nodeId` (1 só target). Usado pelo adaptador
 * para calcular o nó de retoma a partir de um resume_node_id legacy.
 */
export function nextTarget(def: AutomationDefinition, nodeId: string, branch?: string): string | null {
  const edges = edgesFrom(def, nodeId, branch);
  return edges.length > 0 ? edges[0].target : null;
}

/**
 * Todas as edges aplicáveis a partir de `nodeId`. Com branch, devolve as edges
 * cujo `sourceHandle` é igual ao branch (path tomado). Sem branch, devolve as
 * edges sem handle (fan-out: N edges → N ramos concorrentes). Um branch sem
 * edge correspondente termina o ramo (devolve []).
 */
export function edgesFrom(def: AutomationDefinition, nodeId: string, branch?: string): AutomationEdge[] {
  if (branch) {
    return def.edges.filter((e) => e.source === nodeId && e.sourceHandle === branch);
  }
  const plain = def.edges.filter((e) => e.source === nodeId && !e.sourceHandle);
  if (plain.length > 0) return plain;
  // Sem branch e sem edges-sem-handle: segue quaisquer edges (nó sem handles definidos).
  return def.edges.filter((e) => e.source === nodeId);
}

/** Um nó é um ponto de junção (join) se tem mais do que uma edge de entrada. */
export function isJoinNode(def: AutomationDefinition, nodeId: string): boolean {
  return inEdges(def, nodeId).length > 1;
}

/** Há um caminho de `from` até `target` seguindo edges? (com guarda de ciclos) */
export function canReach(def: AutomationDefinition, from: string, target: string): boolean {
  if (from === target) return true;
  const seen = new Set<string>([from]);
  const stack = [from];
  while (stack.length > 0) {
    const cur = stack.pop() as string;
    for (const e of def.edges) {
      if (e.source !== cur) continue;
      if (e.target === target) return true;
      if (!seen.has(e.target)) {
        seen.add(e.target);
        stack.push(e.target);
      }
    }
  }
  return false;
}

/**
 * Um join está pronto a disparar quando já recebeu pelo menos um arrival e
 * nenhum frame vivo no frontier (excepto frames já no próprio join) ainda
 * consegue alcançá-lo. Trata ramos mortos (_halt) e branches não-tomados sem
 * deadlock: deixam de ser predecessores pendentes.
 */
export function joinReady(def: AutomationDefinition, state: RunnerState, nodeId: string): boolean {
  const arrived = state.joins[nodeId]?.arrived.length ?? 0;
  if (arrived === 0) return false;
  const livePending = state.frontier.some((f) => f.nodeId !== nodeId && canReach(def, f.nodeId, nodeId));
  return !livePending;
}

/** Regista a chegada de uma edge a um nó-join (idempotente por edgeId). */
export function registerArrival(state: RunnerState, targetNodeId: string, edgeId: string): void {
  const entry = state.joins[targetNodeId] ?? { arrived: [] };
  if (!entry.arrived.includes(edgeId)) entry.arrived.push(edgeId);
  state.joins[targetNodeId] = entry;
}

/** Colapsa frames com o mesmo nó e mesma pilha de loop (ex: ramos a juntar-se). */
export function dedupeFrontier(frames: Frame[]): Frame[] {
  const seen = new Set<string>();
  const out: Frame[] = [];
  for (const f of frames) {
    const key = `${f.nodeId}|${JSON.stringify(f.loopStack)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  return out;
}

/** Executa `items` em blocos de `limit`, preservando a ordem de entrada. */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const chunk = items.slice(i, i + limit);
    const chunkResults = await Promise.all(chunk.map((it, j) => fn(it, i + j)));
    results.push(...chunkResults);
  }
  return results;
}

/**
 * Constrói o scope de variáveis para resolver templates de um nó: contexto base
 * (contact/deal/imovel/trigger) + outputs acumulados + scope do loop no topo da
 * pilha ({{item}}/{{index}}). Loops entram em T3; em T1 `loopStack` é sempre [].
 */
export function buildScope(
  baseContext: Record<string, unknown>,
  variables: Record<string, { output: unknown }>,
  loopStack: LoopFrame[],
): Record<string, unknown> {
  const scope: Record<string, unknown> = { ...baseContext, ...variables };
  const top = loopStack[loopStack.length - 1];
  if (top) {
    scope.item = top.items[top.index];
    scope.index = top.index;
  }
  return scope;
}

export function createInitialState(startNodeId: string): RunnerState {
  return {
    variables: {},
    frontier: [{ frameId: 'root', nodeId: startNodeId, loopStack: [] }],
    joins: {},
    visited: [],
    iterationCount: 0,
  };
}

// ----------------------------------------------------------------------------
// Driver — multi-frame com fan-out, join automático e concorrência limitada
// ----------------------------------------------------------------------------
export async function runGraph(
  def: AutomationDefinition,
  opts: { startNodeId: string; state: RunnerState; deps: RunnerDeps },
): Promise<RunOutcome> {
  const { state, deps } = opts;
  state.frontier = [{ frameId: 'root', nodeId: opts.startNodeId, loopStack: [] }];

  while (state.frontier.length > 0 && state.iterationCount < SAFETY_CAP) {
    // 1. Separa frames prontos dos joins ainda à espera de mais ramos.
    const ready: Frame[] = [];
    const waiting: Frame[] = [];
    for (const f of state.frontier) {
      if (isJoinNode(def, f.nodeId) && !joinReady(def, state, f.nodeId)) waiting.push(f);
      else ready.push(f);
    }
    // Só restam joins não-armados → nada avança (guarda anti-deadlock).
    if (ready.length === 0) break;

    // 2. Ordem determinística antes do Promise.all (testes não-flaky).
    ready.sort((a, b) =>
      a.nodeId < b.nodeId ? -1 : a.nodeId > b.nodeId ? 1 : a.frameId < b.frameId ? -1 : a.frameId > b.frameId ? 1 : 0,
    );
    state.iterationCount += ready.length;

    // 3. Executa o tick com cap de concorrência (preserva ordem de entrada).
    const execResults = await runWithConcurrency(ready, CONCURRENCY_CAP, async (frame) => {
      const node = nodeById(def, frame.nodeId);
      if (!node) return { frame, node: null as AutomationNode | null, output: null as AtomOutput | null, error: `node not found: ${frame.nodeId}` };
      const vars = buildScope(deps.baseContext, state.variables, frame.loopStack);
      try {
        const output = await deps.runNode(node, vars);
        return { frame, node, output, error: null as string | null };
      } catch (e) {
        return { frame, node, output: null as AtomOutput | null, error: e instanceof Error ? e.message : String(e) };
      }
    });

    // 4. Funde resultados serialmente, na ordem de `ready` (last-write determinístico).
    const nextFrontier: Frame[] = [...waiting];
    for (const r of execResults) {
      if (r.error) {
        return { result: { kind: 'error', nodeId: r.frame.nodeId, message: r.error }, state };
      }
      const node = r.node as AutomationNode;
      const output = r.output as AtomOutput;
      state.variables[node.id] = { output };
      state.visited.push(node.id);

      // Terminação suave: o ramo morre, não propaga sucessores.
      if (output?._halt === true) continue;

      // Suspensão: T2 mantém a semântica single-frame (T4 generaliza multi-frame).
      if (output?._suspend === true && typeof output._resumeAt === 'string') {
        return {
          result: {
            kind: 'suspended',
            suspendNodeId: node.id,
            resumeAt: output._resumeAt,
            approvalToken: typeof output._approval_token === 'string' ? output._approval_token : undefined,
          },
          state,
        };
      }

      // Fan-out: expande todas as edges aplicáveis em novos frames.
      const branch = typeof output?._branch_taken === 'string' ? output._branch_taken : undefined;
      for (const edge of edgesFrom(def, node.id, branch)) {
        if (isJoinNode(def, edge.target)) registerArrival(state, edge.target, edge.id);
        nextFrontier.push({ frameId: `${r.frame.frameId}/${edge.id}`, nodeId: edge.target, loopStack: r.frame.loopStack });
      }
    }

    state.frontier = dedupeFrontier(nextFrontier);
  }

  return { result: { kind: 'done' }, state };
}
