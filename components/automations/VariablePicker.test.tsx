// ============================================================================
// Testes do VariablePicker + TextField (Sprint 37 Fase 2).
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { VariablePicker } from './VariablePicker';
import { TextField } from './TextField';

describe('VariablePicker', () => {
  it('insere o token escolhido', () => {
    const onInsert = vi.fn();
    render(<VariablePicker onInsert={onInsert} />);
    fireEvent.click(screen.getByText('Nome do contacto'));
    expect(onInsert).toHaveBeenCalledWith('{{ contact.name }}');
  });
});

describe('TextField', () => {
  function Controlled({ initial = '' }: { initial?: string }) {
    const [val, setVal] = useState(initial);
    return (
      <div>
        <TextField value={val} onChange={setVal} />
        <output>{val}</output>
      </div>
    );
  }

  it('insere a variável no campo vazio', () => {
    render(<Controlled />);
    fireEvent.click(screen.getByText('Nome do contacto'));
    expect(screen.getByRole('status').textContent).toBe('{{ contact.name }}');
  });

  it('acrescenta a variável ao texto existente (sem cursor = no fim)', () => {
    render(<Controlled initial="Olá " />);
    fireEvent.click(screen.getByText('Nome do contacto'));
    expect(screen.getByRole('status').textContent).toContain('Olá ');
    expect(screen.getByRole('status').textContent).toContain('{{ contact.name }}');
  });
});
