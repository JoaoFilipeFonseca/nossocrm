// ============================================================================
// Testes do KeyValueEditor (Sprint 37 Fase 2).
// ============================================================================

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { KeyValueEditor } from './KeyValueEditor';

describe('KeyValueEditor', () => {
  it('mostra os pares existentes', () => {
    render(<KeyValueEditor value={{ Authorization: 'Bearer x' }} onChange={() => {}} />);
    expect((screen.getByLabelText('chave 1') as HTMLInputElement).value).toBe('Authorization');
    expect((screen.getByLabelText('valor 1') as HTMLInputElement).value).toBe('Bearer x');
  });

  it('grava um objecto ao preencher chave e valor', () => {
    const onChange = vi.fn();
    render(<KeyValueEditor value={undefined} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('chave 1'), { target: { value: 'X-Token' } });
    fireEvent.change(screen.getByLabelText('valor 1'), { target: { value: 'abc' } });
    expect(onChange).toHaveBeenLastCalledWith({ 'X-Token': 'abc' });
  });

  it('adicionar linha cria um novo par', () => {
    render(<KeyValueEditor value={{ a: '1' }} onChange={() => {}} />);
    fireEvent.click(screen.getByText('＋ adicionar linha'));
    expect(screen.getByLabelText('chave 2')).toBeInTheDocument();
  });

  it('remover a única linha limpa o valor (undefined)', () => {
    const onChange = vi.fn();
    render(<KeyValueEditor value={{ a: '1' }} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('remover linha 1'));
    expect(onChange).toHaveBeenLastCalledWith(undefined);
  });
});
