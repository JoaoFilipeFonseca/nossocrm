// ============================================================================
// Testes do runner puro (T1 — paridade com o walk de cursor único).
// O runNode é injectado/mockado, por isso o runner fica 100% determinístico.
// ============================================================================

import { describe, it, expect } from 'vitest';
import {
  runGraph,
  findStartNode,
  nextTarget,
  buildScope,
  createInitialState,
  SAFETY_CAP,
  type AutomationDefinition,
  type AutomationNode,
  type AtomOutput,
  type RunnerDeps,
} from './runner.ts';

// Constrói uma definição a partir de nós e edges abreviadas.
function def(
  nodes: Array<[string, string]>, // [id, atom]
  edges: Array<[string, string, string?]>, // [source, target, sourceHandle?]
): AutomationDefinition {
  return {
    nodes: nodes.map(([id, atom]) => ({ id, atom, config: {} })),
    edges: edges.map(([source, target, sourceHandle], i) => ({
      id: `e${i}`,
      source,
      target,
      ...(sourceHandle ? { sourceHandle } : {}),
    })),
  };
}

// runNode mockado: devolve o output que a tabela `outputs` define para o atom/id.
function makeDeps(
  outputs: Record<string, AtomOutput>,
  order: string[],
  opts: { throwOn?: string; baseContext?: Record<string, unknown> } = {},
): RunnerDeps {
  return {
    baseContext: opts.baseContext ?? {},
    runNode: async (node: AutomationNode) => {
      order.push(node.id);
      if (opts.throwOn === node.id) throw new Error(`boom:${node.id}`);
      return outputs[node.id] ?? {};
    },
  };
}

describe('helpers de grafo', () => {
  it('findStartNode devolve o nó sem edges de entrada', () => {
    const d = def([['a', 'trigger.event'], ['b', 'action.log']], [['a', 'b']]);
    expect(findStartNode(d)?.id).toBe('a');
  });

  it('nextTarget prefere a edge do branch', () => {
    const d = def([['c', 'logic.condition'], ['t', 'action.log'], ['f', 'action.log']], [
      ['c', 't', 'true'],
      ['c', 'f', 'false'],
    ]);
    expect(nextTarget(d, 'c', 'true')).toBe('t');
    expect(nextTarget(d, 'c', 'false')).toBe('f');
  });

  it('nextTarget cai na edge sem handle quando não há branch', () => {
    const d = def([['a', 'action.log'], ['b', 'action.log']], [['a', 'b']]);
    expect(nextTarget(d, 'a')).toBe('b');
    expect(nextTarget(d, 'b')).toBeNull();
  });

  it('buildScope injecta item/index do topo da pilha de loop', () => {
    const scope = buildScope({ contact: { id: '1' } }, { n1: { output: { x: 1 } } }, [
      { loopNodeId: 'L', items: ['a', 'b'], index: 1, bodyEntryId: 'b1' },
    ]);
    expect(scope.contact).toEqual({ id: '1' });
    expect((scope.n1 as { output: unknown }).output).toEqual({ x: 1 });
    expect(scope.item).toBe('b');
    expect(scope.index).toBe(1);
  });
});

describe('runGraph — paridade T1', () => {
  it('percorre uma cadeia linear pela ordem das edges', async () => {
    const d = def([['a', 'trigger.event'], ['b', 'action.log'], ['c', 'action.log']], [
      ['a', 'b'],
      ['b', 'c'],
    ]);
    const order: string[] = [];
    const { result, state } = await runGraph(d, {
      startNodeId: 'a',
      state: createInitialState('a'),
      deps: makeDeps({}, order),
    });
    expect(result.kind).toBe('done');
    expect(order).toEqual(['a', 'b', 'c']);
    expect(state.visited).toEqual(['a', 'b', 'c']);
  });

  it('segue o ramo true de um condition', async () => {
    const d = def([['c', 'logic.condition'], ['t', 'action.log'], ['f', 'action.log']], [
      ['c', 't', 'true'],
      ['c', 'f', 'false'],
    ]);
    const order: string[] = [];
    const { result } = await runGraph(d, {
      startNodeId: 'c',
      state: createInitialState('c'),
      deps: makeDeps({ c: { _branch_taken: 'true' } }, order),
    });
    expect(result.kind).toBe('done');
    expect(order).toEqual(['c', 't']);
  });

  it('_halt termina suave sem seguir mais edges', async () => {
    const d = def([['a', 'action.log'], ['stop', 'logic.filter'], ['z', 'action.log']], [
      ['a', 'stop'],
      ['stop', 'z'],
    ]);
    const order: string[] = [];
    const { result } = await runGraph(d, {
      startNodeId: 'a',
      state: createInitialState('a'),
      deps: makeDeps({ stop: { _halt: true } }, order),
    });
    expect(result.kind).toBe('done');
    expect(order).toEqual(['a', 'stop']); // 'z' nunca corre
  });

  it('_suspend devolve o nó e o resumeAt', async () => {
    const d = def([['a', 'action.log'], ['w', 'logic.wait_fixed'], ['z', 'action.log']], [
      ['a', 'w'],
      ['w', 'z'],
    ]);
    const order: string[] = [];
    const { result } = await runGraph(d, {
      startNodeId: 'a',
      state: createInitialState('a'),
      deps: makeDeps({ w: { _suspend: true, _resumeAt: '2026-06-01T10:00:00.000Z' } }, order),
    });
    expect(result).toEqual({ kind: 'suspended', suspendNodeId: 'w', resumeAt: '2026-06-01T10:00:00.000Z', approvalToken: undefined });
    expect(order).toEqual(['a', 'w']);
  });

  it('propaga approvalToken no suspend', async () => {
    const d = def([['h', 'logic.human_approval']], []);
    const order: string[] = [];
    const { result } = await runGraph(d, {
      startNodeId: 'h',
      state: createInitialState('h'),
      deps: makeDeps({ h: { _suspend: true, _resumeAt: '2026-06-02T09:00:00.000Z', _approval_token: 'tok123' } }, order),
    });
    expect(result).toEqual({ kind: 'suspended', suspendNodeId: 'h', resumeAt: '2026-06-02T09:00:00.000Z', approvalToken: 'tok123' });
  });

  it('erro do átomo devolve kind:error com nodeId e mensagem', async () => {
    const d = def([['a', 'action.log'], ['b', 'action.http_request']], [['a', 'b']]);
    const order: string[] = [];
    const { result } = await runGraph(d, {
      startNodeId: 'a',
      state: createInitialState('a'),
      deps: makeDeps({}, order, { throwOn: 'b' }),
    });
    expect(result).toEqual({ kind: 'error', nodeId: 'b', message: 'boom:b' });
  });

  it('nó inexistente devolve erro', async () => {
    const d = def([['a', 'action.log']], []);
    const { result } = await runGraph(d, {
      startNodeId: 'inexistente',
      state: createInitialState('inexistente'),
      deps: makeDeps({}, []),
    });
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.nodeId).toBe('inexistente');
  });

  it('respeita o tecto de segurança em ciclos', async () => {
    // a -> a (auto-ciclo): sem _halt/_suspend, pára no SAFETY_CAP.
    const d = def([['a', 'action.log']], [['a', 'a']]);
    const order: string[] = [];
    const { result, state } = await runGraph(d, {
      startNodeId: 'a',
      state: createInitialState('a'),
      deps: makeDeps({}, order),
    });
    expect(result.kind).toBe('done');
    expect(state.iterationCount).toBe(SAFETY_CAP);
  });

  it('passa o baseContext ao resolver o scope', async () => {
    const d = def([['a', 'action.log']], []);
    const seen: Record<string, unknown>[] = [];
    const deps: RunnerDeps = {
      baseContext: { contact: { id: 'c1' }, trigger: { type: 'manual' } },
      runNode: async (_node, vars) => {
        seen.push(vars);
        return {};
      },
    };
    await runGraph(d, { startNodeId: 'a', state: createInitialState('a'), deps });
    expect(seen[0].contact).toEqual({ id: 'c1' });
    expect(seen[0].trigger).toEqual({ type: 'manual' });
  });
});

describe('runGraph — fan-out + join (T2)', () => {
  it('diamante: D corre uma só vez, depois de B e C', async () => {
    const d = def([['a', 'trigger.event'], ['b', 'action.log'], ['c', 'action.log'], ['dd', 'action.log']], [
      ['a', 'b'],
      ['a', 'c'],
      ['b', 'dd'],
      ['c', 'dd'],
    ]);
    const order: string[] = [];
    const { result, state } = await runGraph(d, {
      startNodeId: 'a',
      state: createInitialState('a'),
      deps: makeDeps({}, order),
    });
    expect(result.kind).toBe('done');
    expect(order).toEqual(['a', 'b', 'c', 'dd']); // dd só após ambos os ramos
    expect(order.filter((id) => id === 'dd')).toHaveLength(1); // join corre 1x
    expect(state.visited.filter((id) => id === 'dd')).toHaveLength(1);
  });

  it('fan-out: todos os ramos paralelos executam', async () => {
    const d = def([['a', 'trigger.event'], ['x', 'action.log'], ['y', 'action.send_telegram'], ['z', 'action.create_task']], [
      ['a', 'x'],
      ['a', 'y'],
      ['a', 'z'],
    ]);
    const order: string[] = [];
    const { result } = await runGraph(d, {
      startNodeId: 'a',
      state: createInitialState('a'),
      deps: makeDeps({}, order),
    });
    expect(result.kind).toBe('done');
    expect(new Set(order)).toEqual(new Set(['a', 'x', 'y', 'z']));
  });

  it('condition: só o ramo tomado arma o join', async () => {
    const d = def([['c', 'logic.condition'], ['dd', 'action.log']], [
      ['c', 'dd', 'true'],
      ['c', 'dd', 'false'],
    ]);
    const order: string[] = [];
    const { result } = await runGraph(d, {
      startNodeId: 'c',
      state: createInitialState('c'),
      deps: makeDeps({ c: { _branch_taken: 'true' } }, order),
    });
    expect(result.kind).toBe('done');
    expect(order).toEqual(['c', 'dd']); // join corre apesar de só 1 ramo chegar
  });

  it('_halt num ramo não bloqueia o join', async () => {
    const d = def([['a', 'trigger.event'], ['b', 'action.log'], ['c', 'logic.filter'], ['dd', 'action.log']], [
      ['a', 'b'],
      ['a', 'c'],
      ['b', 'dd'],
      ['c', 'dd'],
    ]);
    const order: string[] = [];
    const { result } = await runGraph(d, {
      startNodeId: 'a',
      state: createInitialState('a'),
      deps: makeDeps({ c: { _halt: true } }, order),
    });
    expect(result.kind).toBe('done');
    expect(order).toEqual(['a', 'b', 'c', 'dd']); // dd corre mesmo com o ramo c morto
    expect(order.filter((id) => id === 'dd')).toHaveLength(1);
  });
});
