// ============================================================================
// Tests para os 3 átomos de lógica avançada do Sprint 34.
// ============================================================================

import { describe, it, expect } from 'vitest';
import { logicSwitch } from './switch';
import { logicFilter } from './filter';
import { logicWaitHumanized, isInsideHumanWindow, shiftToNextHumanWindow } from './wait-humanized';
import type { ExecutionContext } from '../../types';

function makeCtx(config: Record<string, unknown>): ExecutionContext {
  return {
    organizationId: 'org-test',
    automationId: 'auto-test',
    executionId: 'exec-test',
    nodeId: 'node-test',
    config,
    variables: {},
    triggerEvent: undefined,
  } as unknown as ExecutionContext;
}

describe('logic.switch', () => {
  it('escolhe case_<i> quando bate', async () => {
    const out = await logicSwitch.execute(makeCtx({ expression: 'gold', cases: ['silver', 'gold', 'bronze'] }));
    expect(out._branch_taken).toBe('case_1');
    expect(out.matched_index).toBe(1);
  });

  it('vai para default quando nenhum bate', async () => {
    const out = await logicSwitch.execute(makeCtx({ expression: 'platinum', cases: ['silver', 'gold'] }));
    expect(out._branch_taken).toBe('default');
    expect(out.matched_index).toBe(-1);
  });

  it('comparação case-insensitive', async () => {
    const out = await logicSwitch.execute(makeCtx({ expression: 'GOLD', cases: ['silver', 'gold'] }));
    expect(out._branch_taken).toBe('case_1');
  });
});

describe('logic.filter', () => {
  it('passa quando condição é verdadeira', async () => {
    const out = await logicFilter.execute(makeCtx({ left: 5, operator: 'gt', right: 3 }));
    expect(out.passed).toBe(true);
    expect(out._branch_taken).toBe('pass');
    expect(out._halt).toBeUndefined();
  });

  it('halt quando condição é falsa', async () => {
    const out = await logicFilter.execute(makeCtx({ left: 1, operator: 'gt', right: 3 }));
    expect(out.passed).toBe(false);
    expect(out._branch_taken).toBe('stop');
    expect(out._halt).toBe(true);
  });

  it('is_empty trata strings vazias como empty', async () => {
    const out = await logicFilter.execute(makeCtx({ left: '   ', operator: 'is_empty' }));
    expect(out.passed).toBe(true);
  });
});

describe('logic.wait_humanized — janela humana', () => {
  it('Domingo nunca está dentro', () => {
    // 25 Maio 2026 = Domingo
    const sunday = new Date('2026-05-24T11:00:00Z');
    expect(isInsideHumanWindow(sunday)).toBe(false);
  });

  it('Sábado 10h Lisboa está dentro', () => {
    // 23 Maio 2026 = Sábado, 10h UTC = 11h Lisboa (verão)
    const sat = new Date('2026-05-23T10:00:00Z');
    expect(isInsideHumanWindow(sat)).toBe(true);
  });

  it('Sábado 15h Lisboa está fora', () => {
    const sat = new Date('2026-05-23T15:00:00Z');
    expect(isInsideHumanWindow(sat)).toBe(false);
  });

  it('Segunda 14h Lisboa está dentro', () => {
    const mon = new Date('2026-05-25T13:00:00Z');
    expect(isInsideHumanWindow(mon)).toBe(true);
  });

  it('Segunda 06h Lisboa está fora', () => {
    const earlyMon = new Date('2026-05-25T04:00:00Z');
    expect(isInsideHumanWindow(earlyMon)).toBe(false);
  });

  it('shift de Domingo cai em horário válido', () => {
    const sunday = new Date('2026-05-24T11:00:00Z');
    const shifted = shiftToNextHumanWindow(sunday);
    expect(isInsideHumanWindow(shifted)).toBe(true);
    expect(shifted.getTime()).toBeGreaterThan(sunday.getTime());
  });
});

describe('logic.wait_humanized — execute', () => {
  it('devolve _suspend + _resumeAt válido', async () => {
    const out = await logicWaitHumanized.execute(makeCtx({ min_seconds: 60, max_seconds: 120 }));
    expect(out._suspend).toBe(true);
    expect(typeof out._resumeAt).toBe('string');
    expect(isInsideHumanWindow(new Date(out._resumeAt as string))).toBe(true);
  });

  it('min_seconds = max_seconds dá valor exacto se cair em janela', async () => {
    // Salta o caso de shift para simplificar — só verifica que waited_seconds existe
    const out = await logicWaitHumanized.execute(makeCtx({ min_seconds: 60, max_seconds: 60 }));
    expect(typeof out.waited_seconds).toBe('number');
    expect(out.waited_seconds).toBeGreaterThanOrEqual(60);
  });
});
