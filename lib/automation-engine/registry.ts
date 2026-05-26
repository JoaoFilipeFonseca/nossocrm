// ============================================================================
// registry.ts — registo de átomos disponíveis na máquina
// ============================================================================
// Sprint 1.0, commit 1 de 5.
//
// API mínima viável: Map<atom_id, AtomDefinition> com register/get/list.
// Auto-discovery por sistema de ficheiros entra no Sprint 1.3 (substitui esta
// versão hardcoded).
//
// Importante: a Edge Function `automation-execute` (Deno) NÃO importa
// directamente daqui (Deno não resolve aliases @/ do Next.js). Tem a sua
// própria cópia inline dos átomos por enquanto. Esta versão é para uso
// futuro no builder (Sprint 2) e em API routes da app (Sprint 1.3).
// ============================================================================

import type { AtomDefinition } from './types';
import { triggerEvent } from './plugins/triggers/event';
import { actionLog } from './plugins/actions/log';

const atoms = new Map<string, AtomDefinition>();

export function registerAtom(def: AtomDefinition): void {
  atoms.set(def.id, def);
}

export function getAtom(id: string): AtomDefinition | undefined {
  return atoms.get(id);
}

export function listAtoms(): AtomDefinition[] {
  return Array.from(atoms.values());
}

export function clearAtomsForTest(): void {
  atoms.clear();
}

// Registo inicial (hardcoded, Sprint 1.0)
registerAtom(triggerEvent);
registerAtom(actionLog);
