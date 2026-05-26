// ============================================================================
// template.ts — Resolver de variáveis {{...}} com LiquidJS
// ============================================================================
// Localização final: /lib/automation-engine/template.ts
// ============================================================================

import { Liquid } from 'liquidjs';

const engine = new Liquid({
  strictVariables: false, // não falha se variável não existe (devolve vazio)
  strictFilters: true,
  cache: true,
});

// ----------------------------------------------------------------------------
// Filtros customizados
// ----------------------------------------------------------------------------
engine.registerFilter('money', (value: unknown, currency = 'EUR') => {
  const num = Number(value);
  if (isNaN(num)) return value;
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency,
  }).format(num);
});

engine.registerFilter('phone_pt', (value: unknown) => {
  if (typeof value !== 'string') return value;
  const digits = value.replace(/\D/g, '');
  if (digits.startsWith('351')) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`;
  }
  return value;
});

engine.registerFilter('first_name', (value: unknown) => {
  if (typeof value !== 'string') return value;
  return value.trim().split(/\s+/)[0];
});

engine.registerFilter('truncate_words', (value: unknown, count = 20) => {
  if (typeof value !== 'string') return value;
  const words = value.split(/\s+/);
  if (words.length <= count) return value;
  return words.slice(0, count).join(' ') + '...';
});

// ----------------------------------------------------------------------------
// API pública
// ----------------------------------------------------------------------------
export async function renderTemplate(
  template: string,
  variables: Record<string, unknown>
): Promise<string> {
  if (!template || typeof template !== 'string') return template ?? '';
  if (!template.includes('{{') && !template.includes('{%')) return template;
  
  try {
    return await engine.parseAndRender(template, variables);
  } catch (err) {
    console.warn('[template] Erro a renderizar:', err);
    return template; // fallback: devolve template não renderizado
  }
}

/**
 * Resolve variáveis recursivamente em qualquer estrutura de dados.
 * Strings são processadas com LiquidJS. Objects e arrays são percorridos.
 */
export async function resolveVariables(
  input: unknown,
  variables: Record<string, unknown>
): Promise<unknown> {
  if (input === null || input === undefined) return input;
  
  if (typeof input === 'string') {
    return await renderTemplate(input, variables);
  }
  
  if (Array.isArray(input)) {
    return Promise.all(input.map((item) => resolveVariables(item, variables)));
  }
  
  if (typeof input === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      result[key] = await resolveVariables(value, variables);
    }
    return result;
  }
  
  return input;
}

/**
 * Extrai todas as referências de variáveis de um template.
 * Útil para validação estática no save da automação.
 */
export function extractVariableReferences(template: string): string[] {
  if (typeof template !== 'string') return [];
  const matches = template.matchAll(/\{\{\s*([\w.]+)/g);
  return Array.from(matches, (m) => m[1]);
}

/**
 * Valida que todas as variáveis usadas estão disponíveis no contexto.
 * Retorna array de referências em falta.
 */
export function validateTemplate(
  template: string,
  availableVariables: string[]
): string[] {
  const used = extractVariableReferences(template);
  return used.filter((ref) => {
    const root = ref.split('.')[0];
    return !availableVariables.includes(root);
  });
}
