/**
 * @fileoverview Origens manuais de contacto (proveniência obrigatória).
 *
 * Fonte ÚNICA das opções de origem para criação manual de contactos/leads.
 * Regra do produto: toda lead criada à mão TEM de ter origem (proveniência).
 * Usado pelo formulário de Novo Contacto e pela criação inline no Novo Negócio.
 * "Outro" cobre os restantes casos.
 *
 * @module lib/contacts/origins
 */

export const ORIGEM_OPTIONS = [
  'Telefone',
  'Indicação',
  'Conhecimento pessoal',
  'Portal Idealista',
  'Portal Imovirtual',
  'Facebook / Instagram',
  'Site',
  'Loja / Walk-in',
  'Publicidade / Cartaz',
  'Outro',
] as const;

/** Texto do placeholder (opção vazia) do seletor de origem. */
export const ORIGEM_PLACEHOLDER = 'Como chegou este contacto?';
