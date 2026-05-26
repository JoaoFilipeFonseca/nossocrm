// ============================================================================
// registry.ts — Catálogo dinâmico de átomos disponíveis
// ============================================================================
// Localização final: /lib/automation-engine/registry.ts
// ============================================================================

import type { AtomDefinition, AtomCategory } from './types';

// Auto-discovery de todos os plugins em /plugins/
// Vite/Next.js resolve este glob no build time
const modules = import.meta.glob<{ default: AtomDefinition }>(
  './plugins/**/*.ts',
  { eager: true }
);

const atoms = new Map<string, AtomDefinition>();

for (const path in modules) {
  // Ignora ficheiros de teste e index
  if (path.includes('.test.') || path.endsWith('/index.ts')) continue;
  
  const atom = modules[path].default;
  
  if (!atom?.id) {
    console.warn(`[registry] Plugin sem id em ${path}`);
    continue;
  }
  
  if (atoms.has(atom.id)) {
    throw new Error(
      `[registry] Plugin duplicado: ${atom.id} (existe em ${path})`
    );
  }
  
  atoms.set(atom.id, atom);
}

console.log(`[registry] ${atoms.size} átomos carregados`);

// ----------------------------------------------------------------------------
// API pública
// ----------------------------------------------------------------------------
export const registry = {
  get(id: string): AtomDefinition | undefined {
    return atoms.get(id);
  },
  
  list(category?: AtomCategory): AtomDefinition[] {
    const all = Array.from(atoms.values()).filter(
      (a) => !a.isDeprecated
    );
    return category ? all.filter((a) => a.category === category) : all;
  },
  
  listByCategory(): Record<AtomCategory, AtomDefinition[]> {
    return {
      trigger: this.list('trigger'),
      action: this.list('action'),
      logic: this.list('logic'),
      data: this.list('data'),
      observability: this.list('observability'),
    };
  },
  
  has(id: string): boolean {
    return atoms.has(id);
  },
  
  count(): number {
    return atoms.size;
  },
  
  // Para sincronização com a tabela automation_atoms_registry
  toRegistryRows() {
    return Array.from(atoms.values()).map((atom) => ({
      id: atom.id,
      category: atom.category,
      name: atom.name,
      icon: atom.icon,
      description: atom.description,
      config_schema: atom.configSchema,
      output_schema: atom.outputSchema,
      requires_integration: atom.requiresIntegration ?? null,
      version: atom.version ?? '1.0',
      is_deprecated: atom.isDeprecated ?? false,
      deprecation_message: atom.deprecationMessage ?? null,
      updated_at: new Date().toISOString(),
    }));
  },
};

// ----------------------------------------------------------------------------
// Sincronização com BD (chamar no boot ou via cron)
// ----------------------------------------------------------------------------
import type { SupabaseClient } from '@supabase/supabase-js';

export async function syncRegistryToDb(supabase: SupabaseClient): Promise<void> {
  const rows = registry.toRegistryRows();
  
  const { error } = await supabase
    .from('automation_atoms_registry')
    .upsert(rows, { onConflict: 'id' });
  
  if (error) {
    console.error('[registry] Erro a sincronizar com BD:', error);
    throw error;
  }
  
  console.log(`[registry] ${rows.length} átomos sincronizados com BD`);
}
