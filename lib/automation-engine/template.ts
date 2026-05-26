// ============================================================================
// template.ts — LiquidJS wrapper para resolver variáveis em strings
// ============================================================================
// Sprint 1.2, commit 1 de 4.
//
// Sintaxe suportada (a partir do Sprint 1.2):
//   {{ contact.name }}
//   {{ trigger.payload.email }}
//   {{ deal.value | money }}
//   {% if contact.is_vip %} ... {% endif %}
//
// Variáveis disponíveis em runtime:
//   - contact, deal, imovel (referências carregadas pelo executor a partir
//     dos IDs presentes em automation_executions)
//   - trigger.payload (payload do trigger.event)
//   - <nodeId>.output (outputs acumulados de nós anteriores)
//
// Filtros custom registados aqui:
//   - money: formata número como euros (€1.234,56). Útil para Foco Imo.
// ============================================================================

import { Liquid } from 'liquidjs';

const engine = new Liquid({
  cache: true,
  greedy: false,
  strictFilters: false,
  strictVariables: false, // variáveis em falta resolvem para vazio, não atira excepção
});

engine.registerFilter('money', (v: unknown): string => {
  const n = typeof v === 'number' ? v : Number(v);
  if (!isFinite(n)) return String(v ?? '');
  return n.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
});

/**
 * Resolve template Liquid com as variáveis dadas.
 * Devolve string vazia se o template for null/undefined.
 */
export async function resolveTemplate(
  template: string | undefined | null,
  variables: Record<string, unknown>,
): Promise<string> {
  if (!template) return '';
  try {
    return await engine.parseAndRender(template, variables);
  } catch {
    return template;
  }
}

/**
 * Aplica resolveTemplate a TODAS as strings de um objecto de config
 * (recursivo). Não-strings ficam intactas.
 */
export async function resolveConfig(
  config: Record<string, unknown>,
  variables: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(config)) {
    out[key] = await resolveValue(value, variables);
  }
  return out;
}

async function resolveValue(value: unknown, variables: Record<string, unknown>): Promise<unknown> {
  if (typeof value === 'string') {
    return resolveTemplate(value, variables);
  }
  if (Array.isArray(value)) {
    return Promise.all(value.map((v) => resolveValue(v, variables)));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = await resolveValue(v, variables);
    }
    return out;
  }
  return value;
}
