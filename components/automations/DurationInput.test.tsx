// ============================================================================
// Testes do DurationInput (Sprint 37 Fase 1) — conversões + render.
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DurationInput, toBase, fromBase, allowedUnits } from './DurationInput';

describe('conversões de duração', () => {
  it('toBase converte para segundos', () => {
    expect(toBase(1, 'days', 'seconds')).toBe(86400);
    expect(toBase(1, 'weeks', 'seconds')).toBe(604800);
    expect(toBase(90, 'seconds', 'seconds')).toBe(90);
  });

  it('toBase converte para horas', () => {
    expect(toBase(1, 'days', 'hours')).toBe(24);
    expect(toBase(2, 'hours', 'hours')).toBe(2);
    expect(toBase(1, 'weeks', 'hours')).toBe(168);
  });

  it('fromBase escolhe a maior unidade exacta (base segundos)', () => {
    expect(fromBase(86400, 'seconds')).toEqual({ value: 1, unitId: 'days' });
    expect(fromBase(3600, 'seconds')).toEqual({ value: 1, unitId: 'hours' });
    expect(fromBase(120, 'seconds')).toEqual({ value: 2, unitId: 'minutes' });
  });

  it('fromBase cai em segundos quando não divide certo', () => {
    expect(fromBase(90, 'seconds')).toEqual({ value: 90, unitId: 'seconds' });
  });

  it('fromBase em base horas', () => {
    expect(fromBase(24, 'hours')).toEqual({ value: 1, unitId: 'days' });
    expect(fromBase(1, 'hours')).toEqual({ value: 1, unitId: 'hours' });
  });

  it('allowedUnits exclui sub-hora quando a base é horas', () => {
    const ids = allowedUnits('hours').map((u) => u.id);
    expect(ids).not.toContain('seconds');
    expect(ids).not.toContain('minutes');
    expect(ids).toContain('hours');
    expect(ids).toContain('days');
  });
});

describe('DurationInput render', () => {
  it('mostra um valor existente na unidade amigável', () => {
    render(<DurationInput value={86400} base="seconds" onChange={() => {}} />);
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('1');
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('days');
  });

  it('emite o valor convertido ao escrever o número', () => {
    const onChange = vi.fn();
    render(<DurationInput value={3600} base="seconds" onChange={onChange} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '2' } });
    expect(onChange).toHaveBeenLastCalledWith(7200); // 2 horas
  });

  it('mantém o número ao mudar a unidade (1 hora -> 1 dia)', () => {
    const onChange = vi.fn();
    render(<DurationInput value={3600} base="seconds" onChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'days' } });
    expect(onChange).toHaveBeenLastCalledWith(86400); // 1 dia
  });

  it('campo vazio emite undefined', () => {
    const onChange = vi.fn();
    render(<DurationInput value={60} base="seconds" onChange={onChange} />);
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } });
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
