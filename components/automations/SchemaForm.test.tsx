// ============================================================================
// Testes do SchemaForm (Sprint 37 Fase 1) — duração + (F1-b) etiquetas enum.
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SchemaForm } from './SchemaForm';

describe('SchemaForm — campo de duração', () => {
  it('rende o widget número + unidade para format duration', () => {
    const schema = {
      type: 'object',
      properties: { seconds: { type: 'integer', format: 'duration', unit: 'seconds' } },
      required: ['seconds'],
    };
    render(<SchemaForm schema={schema} values={{ seconds: 86400 }} onChange={() => {}} />);
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('1');
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('days');
  });

  it('campos normais continuam a renderizar (string → textbox)', () => {
    const schema = { type: 'object', properties: { url: { type: 'string' } } };
    render(<SchemaForm schema={schema} values={{}} onChange={() => {}} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});

describe('SchemaForm — etiquetas humanas (enumLabels)', () => {
  it('mostra a etiqueta PT mas grava o valor técnico', () => {
    const onChange = vi.fn();
    const schema = {
      type: 'object',
      properties: {
        operator: { type: 'string', enum: ['eq', 'gt'], enumLabels: ['igual a', 'maior que'] },
      },
    };
    render(<SchemaForm schema={schema} values={{}} onChange={onChange} />);
    // a opção mostra o texto humano
    expect(screen.getByRole('option', { name: 'maior que' })).toBeInTheDocument();
    // mas grava o valor técnico
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'gt' } });
    expect(onChange).toHaveBeenLastCalledWith({ operator: 'gt' });
  });
});
