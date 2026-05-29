// ============================================================================
// Testes do LoopNode + metadata logic.loop no catálogo (Sprint 37 T5).
// ============================================================================

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { LoopNode } from './LoopNode';
import { getAtomMeta } from '@/lib/automation-engine/catalog';

describe('catálogo — logic.loop', () => {
  it('expõe metadata do átomo de loop', () => {
    const meta = getAtomMeta('logic.loop');
    expect(meta).toBeDefined();
    expect(meta?.category).toBe('logic');
    expect(meta?.icon).toBe('🔁');
    const schema = meta?.configSchema as { properties?: Record<string, unknown>; required?: string[] };
    expect(schema.properties).toHaveProperty('items');
    expect(schema.properties).toHaveProperty('max_iterations');
    expect(schema.properties).toHaveProperty('parallel');
    expect(schema.required).toContain('items');
  });
});

describe('LoopNode', () => {
  function renderNode(config: Record<string, unknown>) {
    return render(
      <ReactFlowProvider>
        <LoopNode
          id="loop1"
          type="logic.loop"
          data={{ atom: 'logic.loop', config }}
          selected={false}
          dragging={false}
          zIndex={0}
          isConnectable
          positionAbsoluteX={0}
          positionAbsoluteY={0}
          // deselect/handles props extra que o NodeProps possa exigir são opcionais
          {...({} as Record<string, unknown>)}
        />
      </ReactFlowProvider>,
    );
  }

  it('mostra o id do átomo e os ramos corpo/concluído', () => {
    renderNode({ items: '{{ contact.deals }}' });
    expect(screen.getByText('logic.loop')).toBeInTheDocument();
    expect(screen.getByText('corpo')).toBeInTheDocument();
    expect(screen.getByText('concluído')).toBeInTheDocument();
    expect(screen.getByText('fim do corpo')).toBeInTheDocument();
  });

  it('mostra a etiqueta "paralelo" quando parallel está ligado', () => {
    renderNode({ items: '{{ x }}', parallel: true });
    expect(screen.getByText('paralelo')).toBeInTheDocument();
  });
});
