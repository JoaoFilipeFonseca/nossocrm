// ============================================================================
// catalog.ts — metadata dos átomos disponível ao client-side
// ============================================================================
// Sprint 2.1, commit 1.
//
// O registry.ts puxa cada AtomDefinition completa, incluindo a função
// execute() e dependências (LiquidJS, fetch a Telegram, etc.). Isso só
// deve correr server-side. Para os components client (Canvas, palette,
// painel config), basta a metadata pública: id, category, name, icon,
// description, schemas.
//
// Este ficheiro é importável de qualquer client component sem arrastar
// código de runtime.
// ============================================================================

export interface AtomMetadata {
  id: string;
  category: 'trigger' | 'action' | 'logic' | 'data' | 'observability';
  name: string;
  icon: string;
  description: string;
  configSchema: Record<string, unknown>;
}

export const ATOM_CATALOG: readonly AtomMetadata[] = [
  {
    id: 'trigger.event',
    category: 'trigger',
    name: 'Quando um evento acontece',
    icon: '⚡',
    description: 'Dispara quando um evento canónico do sistema é publicado.',
    configSchema: {
      type: 'object',
      properties: {
        events: { type: 'array', items: { type: 'string' }, minItems: 1 },
      },
      required: ['events'],
    },
  },
  {
    id: 'action.log',
    category: 'action',
    name: 'Registar mensagem',
    icon: '📝',
    description: 'Escreve uma mensagem no histórico da execução.',
    configSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        level: { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
      },
      required: ['message'],
    },
  },
  {
    id: 'action.http_request',
    category: 'action',
    name: 'Chamada HTTP',
    icon: '🌐',
    description: 'Faz pedido HTTP a um URL externo.',
    configSchema: {
      type: 'object',
      properties: {
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
        url: { type: 'string' },
        headers: { type: 'object' },
        body: { type: 'string' },
        timeout_ms: { type: 'integer' },
      },
      required: ['url'],
    },
  },
  {
    id: 'action.send_telegram',
    category: 'action',
    name: 'Enviar Telegram',
    icon: '📨',
    description: 'Envia mensagem para o teu bot Telegram.',
    configSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' },
        chat_id: { type: 'string' },
        parse_mode: { type: 'string', enum: ['HTML', 'MarkdownV2', 'none'] },
      },
      required: ['text'],
    },
  },
  {
    id: 'logic.wait_fixed',
    category: 'logic',
    name: 'Esperar tempo fixo',
    icon: '⏱️',
    description: 'Suspende a automação por X segundos antes de continuar.',
    configSchema: {
      type: 'object',
      properties: {
        seconds: { type: 'integer', minimum: 1 },
      },
      required: ['seconds'],
    },
  },
];

const byId = new Map(ATOM_CATALOG.map((a) => [a.id, a]));

export function getAtomMeta(id: string): AtomMetadata | undefined {
  return byId.get(id);
}

export function listAtomMeta(): AtomMetadata[] {
  return [...ATOM_CATALOG];
}
