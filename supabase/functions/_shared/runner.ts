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
 * Próximo nó a seguir a partir de `nodeId`. Se houver um branch, prefere a edge
 * cujo `sourceHandle` é igual ao branch; senão a primeira edge sem handle, ou
 * qualquer edge. Devolve o id do target ou null. (Paridade T1: 1 só target.)
 */
export function nextTarget(def: AutomationDefinition, nodeId: string, branch?: string): string | null {
  if (branch) {
    const branched = def.edges.find((e) => e.source === nodeId && e.sourceHandle === branch);
    if (branched) return branched.target;
  }
  const fallback =
    def.edges.find((e) => e.source === nodeId && !e.sourceHandle) ??
    def.edges.find((e) => e.source === nodeId);
  return fallback ? fallback.target : null;
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
// Driver — T1: cursor único (paridade exacta com o walk anterior)
// ----------------------------------------------------------------------------
export async function runGraph(
  def: AutomationDefinition,
  opts: { startNodeId: string; state: RunnerState; deps: RunnerDeps },
): Promise<RunOutcome> {
  const { state, deps } = opts;
  let current: string | null = opts.startNodeId;

  while (current && state.iterationCount < SAFETY_CAP) {
    state.iterationCount += 1;
    const node = nodeById(def, current);
    if (!node) {
      return { result: { kind: 'error', nodeId: current, message: `node not found: ${current}` }, state };
    }

    const vars = buildScope(deps.baseContext, state.variables, []);

    let output: AtomOutput;
    try {
      output = await deps.runNode(node, vars);
    } catch (e) {
      return { result: { kind: 'error', nodeId: node.id, message: e instanceof Error ? e.message : String(e) }, state };
    }

    state.variables[node.id] = { output };
    state.visited.push(node.id);

    // Terminação suave (logic.filter que não passa).
    if (output?._halt === true) {
      return { result: { kind: 'done' }, state };
    }

    // Suspensão (waits, aprovação humana).
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

    const branch = typeof output?._branch_taken === 'string' ? output._branch_taken : undefined;
    current = nextTarget(def, node.id, branch);
  }

  return { result: { kind: 'done' }, state };
}
