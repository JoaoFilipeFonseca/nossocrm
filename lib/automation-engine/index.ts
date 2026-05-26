// ============================================================================
// lib/automation-engine — Máquina de Automações Foco Imo (raiz pública)
// ============================================================================
// Re-exporta os tipos partilhados. À medida que módulos forem adicionados
// (registry, event-bus, workflow-engine, template, etc.), são re-exportados
// daqui para que o resto do CRM importe sempre por `@/lib/automation-engine`.
// ============================================================================

export * from './types';
export * from './event-bus';
