// ============================================================================
// builder-catalog.ts — listas humanas para o builder de automações (client-side)
// ============================================================================
// Sprint 37 Fase 2.
//
// Fonte única, importável de qualquer client component, para:
//   - EMITTED_EVENTS: os eventos que o sistema REALMENTE dispara (triggers em
//     supabase/migrations/20260526120100_automation_publish_event_triggers.sql).
//     Só estes devem ser oferecidos no gatilho, senão criam-se automações que
//     nunca correm.
//   - BUILDER_VARIABLES: variáveis úteis para inserir nos campos de texto.
// ============================================================================

export interface EmittedEvent {
  id: string;
  label: string;
  group: string;
}

export const EMITTED_EVENTS: readonly EmittedEvent[] = [
  { id: 'contact.created', label: 'Quando um contacto é criado', group: 'Contactos' },
  { id: 'contact.updated', label: 'Quando um contacto é actualizado', group: 'Contactos' },
  { id: 'contact.stage.changed', label: 'Quando um contacto muda de etapa', group: 'Contactos' },
  { id: 'contact.deleted', label: 'Quando um contacto é eliminado', group: 'Contactos' },
  { id: 'deal.created', label: 'Quando um negócio é criado', group: 'Negócios' },
  { id: 'deal.updated', label: 'Quando um negócio é actualizado', group: 'Negócios' },
  { id: 'deal.stage.changed', label: 'Quando um negócio muda de etapa', group: 'Negócios' },
  { id: 'deal.won', label: 'Quando um negócio é ganho', group: 'Negócios' },
  { id: 'deal.lost', label: 'Quando um negócio é perdido', group: 'Negócios' },
  { id: 'lead.meta_ads', label: 'Quando entra uma lead do Meta Ads (Facebook/Instagram)', group: 'Leads' },
  { id: 'lead.captured', label: 'Quando entra uma lead de captação (formulários ou Meta Ads)', group: 'Leads' },
];

export interface BuilderVariable {
  token: string;
  label: string;
  group: string;
}

export const BUILDER_VARIABLES: readonly BuilderVariable[] = [
  { token: '{{ contact.id }}', label: 'ID do contacto', group: 'Contacto' },
  { token: '{{ contact.name }}', label: 'Nome do contacto', group: 'Contacto' },
  { token: '{{ contact.email }}', label: 'Email do contacto', group: 'Contacto' },
  { token: '{{ contact.phone }}', label: 'Telefone do contacto', group: 'Contacto' },
  { token: '{{ contact.stage }}', label: 'Etapa do contacto', group: 'Contacto' },
  { token: '{{ deal.id }}', label: 'ID do negócio', group: 'Negócio' },
  { token: '{{ deal.title }}', label: 'Título do negócio', group: 'Negócio' },
  { token: '{{ deal.value | money }}', label: 'Valor do negócio (formatado)', group: 'Negócio' },
  { token: '{{ deal.status }}', label: 'Estado do negócio', group: 'Negócio' },
  { token: '{{ trigger.payload }}', label: 'Dados do evento que disparou', group: 'Evento' },
  { token: '{{ item }}', label: 'Item actual do loop', group: 'Loop' },
  { token: '{{ index }}', label: 'Posição actual do loop', group: 'Loop' },
];
