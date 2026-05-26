// ============================================================================
// registry.ts — registo de átomos disponíveis na máquina
// ============================================================================
// Sprint 1.3, refactor c3.
//
// Estratégia anterior (Sprint 1.0 a 1.2): import explícito de cada átomo +
// registerAtom() hardcoded ao fim deste ficheiro.
//
// Agora (Sprint 1.3): "auto-discovery por barrel". `plugins/index.ts`
// re-exporta todos os átomos. Aqui iteramos Object.values e registamos
// tudo o que respeite o shape de AtomDefinition (tem `id` + `execute`).
//
// Adicionar átomo novo = criar ficheiro em plugins/<categoria>/ + adicionar
// re-export em plugins/index.ts. Zero mudanças neste ficheiro.
//
// Nota: a Edge Function `automation-execute` (Deno) mantém um registry
// inline porque Deno não resolve aliases @/ do Next. Unificação Deno-Next
// fica para Sprint 1.4 via manifest gerado.
// ============================================================================

import type { AtomDefinition } from './types';
import * as plugins from './plugins';

const atoms = new Map<string, AtomDefinition>();

/**
 * Type guard: confirma que um objecto cumpre o shape mínimo de AtomDefinition.
 */
function isAtomDefinition(value: unknown): value is AtomDefinition {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.category === 'string' &&
    typeof v.execute === 'function'
  );
}

/**
 * Regista todos os átomos exportados pelo barrel plugins/index.ts.
 * Idempotente: pode correr múltiplas vezes (overwrite por id).
 */
function autoRegister(): void {
  for (const exported of Object.values(plugins)) {
    if (isAtomDefinition(exported)) {
      atoms.set(exported.id, exported);
    }
  }
}

autoRegister();

export function registerAtom(def: AtomDefinition): void {
  atoms.set(def.id, def);
}

export function getAtom(id: string): AtomDefinition | undefined {
  return atoms.get(id);
}

export function listAtoms(): AtomDefinition[] {
  return Array.from(atoms.values());
}

export function listAtomIds(): string[] {
  return Array.from(atoms.keys()).sort();
}

export function clearAtomsForTest(): void {
  atoms.clear();
}
