// ============================================================================
// Testes do EventMultiSelect (Sprint 37 Fase 2).
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventMultiSelect } from './EventMultiSelect';
import { EMITTED_EVENTS } from '@/lib/automation-engine/builder-catalog';

describe('EventMultiSelect', () => {
  it('mostra os 11 eventos reais com nomes em PT', () => {
    render(<EventMultiSelect value={[]} onChange={() => {}} />);
    expect(EMITTED_EVENTS).toHaveLength(11);
    expect(screen.getByText('Quando um contacto é criado')).toBeInTheDocument();
    expect(screen.getByText('Quando um negócio é ganho')).toBeInTheDocument();
    expect(
      screen.getByText('Quando entra uma lead do Meta Ads (Facebook/Instagram)'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Quando entra uma lead de captação (formulários ou Meta Ads)'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(11);
  });

  it('grava o id técnico ao marcar', () => {
    const onChange = vi.fn();
    render(<EventMultiSelect value={[]} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Quando um negócio é ganho'));
    expect(onChange).toHaveBeenLastCalledWith(['deal.won']);
  });

  it('pré-selecciona valores existentes e permite desmarcar', () => {
    const onChange = vi.fn();
    render(<EventMultiSelect value={['contact.created']} onChange={onChange} />);
    const cb = screen.getByLabelText('Quando um contacto é criado') as HTMLInputElement;
    expect(cb.checked).toBe(true);
    fireEvent.click(cb);
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
