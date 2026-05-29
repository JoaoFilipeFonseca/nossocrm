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
    id: 'action.modify_contact',
    category: 'action',
    name: 'Actualizar contacto',
    icon: '👤',
    description: 'Muda stage, status, ou notas de um contacto.',
    configSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string' },
        stage: { type: 'string' },
        status: { type: 'string' },
        notes: { type: 'string' },
        append_notes: { type: 'string' },
      },
    },
  },
  {
    id: 'action.modify_deal',
    category: 'action',
    name: 'Actualizar deal',
    icon: '💼',
    description: 'Muda status, valor, prioridade ou tags de um deal.',
    configSchema: {
      type: 'object',
      properties: {
        deal_id: { type: 'string' },
        status: { type: 'string' },
        priority: { type: 'string' },
        value: { type: 'number' },
        tags: { type: 'array', items: { type: 'string' } },
        append_tag: { type: 'string' },
      },
    },
  },
  {
    id: 'action.create_task',
    category: 'action',
    name: 'Criar tarefa',
    icon: '✅',
    description: 'Cria uma activity ligada a contacto ou deal.',
    configSchema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        description: { type: 'string' },
        type: { type: 'string' },
        contact_id: { type: 'string' },
        deal_id: { type: 'string' },
        due_in_hours: { type: 'number' },
        due_at: { type: 'string' },
      },
      required: ['title'],
    },
  },
  {
    id: 'action.run_ai',
    category: 'action',
    name: 'Correr IA',
    icon: '🧠',
    description: 'Corre prompt IA (Gemini + fallback Anthropic). Output em {{ este_passo.output.text }}.',
    configSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        system: { type: 'string' },
        feature: { type: 'string', enum: ['generic', 'email_draft', 'whatsapp_draft', 'workflow_desc', 'workflow_icp', 'workflow_swot', 'workflow_pitch', 'deal_coach', 'imovel_extract', 'briefing'] },
        temperature: { type: 'number', minimum: 0 },
      },
      required: ['prompt'],
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
  {
    id: 'logic.human_approval',
    category: 'logic',
    name: 'Aprovação humana',
    icon: '🙋',
    description: 'Pede decisão no Telegram. Bifurca em approved/rejected/edited.',
    configSchema: {
      type: 'object',
      properties: {
        message: { type: 'string' },
        approve_label: { type: 'string' },
        reject_label: { type: 'string' },
        edit_label: { type: 'string' },
        timeout_hours: { type: 'integer', minimum: 1 },
      },
      required: ['message'],
    },
  },
  {
    id: 'logic.condition',
    category: 'logic',
    name: 'Se / Então',
    icon: '🔀',
    description: 'Bifurca o fluxo entre ramos "true" e "false".',
    configSchema: {
      type: 'object',
      properties: {
        left: {},
        operator: { type: 'string', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'starts_with', 'ends_with', 'in', 'is_empty', 'is_not_empty'] },
        right: {},
      },
      required: ['left', 'operator'],
    },
  },
  {
    id: 'trigger.schedule',
    category: 'trigger',
    name: 'Disparar por horário',
    icon: '⏰',
    description: 'Cron-like. Dispara a automação a cada X minutos / dias / horários definidos.',
    configSchema: {
      type: 'object',
      properties: {
        cron: { type: 'string', description: 'Expressão cron 5 campos (ex: 0 9 * * 1-5 = 09h dias úteis).' },
        timezone: { type: 'string', description: 'Timezone (default Europe/Lisbon).' },
      },
      required: ['cron'],
    },
  },
  {
    id: 'action.send_whatsapp',
    category: 'action',
    name: 'Enviar WhatsApp',
    icon: '💬',
    description: 'Envia mensagem via canal WhatsApp configurado (Meta WABA).',
    configSchema: {
      type: 'object',
      properties: {
        to: { type: 'string', description: 'Número destino com indicativo (ex: 351912345678).' },
        text: { type: 'string' },
        template_name: { type: 'string', description: 'Se usar template Meta pré-aprovado.' },
        template_vars: { type: 'array', items: { type: 'string' } },
      },
      required: ['to'],
    },
  },
  {
    id: 'action.send_email',
    category: 'action',
    name: 'Enviar email',
    icon: '📧',
    description: 'Envia email via Resend. Necessita DKIM/SPF configurados.',
    configSchema: {
      type: 'object',
      properties: {
        to: { type: 'string' },
        from: { type: 'string', description: 'Remetente (deixa em branco para usar default da org).' },
        subject: { type: 'string' },
        html: { type: 'string', description: 'Corpo HTML. Suporta {{...}}.' },
        text: { type: 'string', description: 'Versão texto. Suporta {{...}}.' },
        reply_to: { type: 'string' },
      },
      required: ['to', 'subject'],
    },
  },
  {
    id: 'logic.wait_until',
    category: 'logic',
    name: 'Esperar até evento',
    icon: '🎯',
    description: 'Suspende até um evento específico chegar (ou timeout). Bifurca em event/timeout.',
    configSchema: {
      type: 'object',
      properties: {
        event_types: { type: 'array', items: { type: 'string' }, minItems: 1 },
        timeout_hours: { type: 'integer', minimum: 1 },
      },
      required: ['event_types', 'timeout_hours'],
    },
  },
  {
    id: 'logic.switch',
    category: 'logic',
    name: 'Escolher (switch)',
    icon: '🔀',
    description: 'Compara um valor com a lista de casos e segue o ramo correspondente (case_0, case_1, ..., default).',
    configSchema: {
      type: 'object',
      properties: {
        expression: { type: 'string' },
        cases: { type: 'array', items: { type: 'string' }, minItems: 1 },
      },
      required: ['expression', 'cases'],
    },
  },
  {
    id: 'logic.loop',
    category: 'logic',
    name: 'Repetir por cada (loop)',
    icon: '🔁',
    description: 'Itera sobre uma lista. Liga o ramo "loop_body" ao corpo e fecha o corpo de volta a este nó; "loop_done" segue quando terminar. Cada iteração expõe {{ item }} e {{ index }}.',
    configSchema: {
      type: 'object',
      properties: {
        items: { type: 'string', description: 'Expressão que resolve numa lista, ex: {{ contact.deals }}.' },
        max_iterations: { type: 'integer', minimum: 1, description: 'Tecto de iterações (default 100).' },
        parallel: { type: 'boolean', description: 'Se ligado, corre as iterações em paralelo (cuidado com efeitos colaterais).' },
      },
      required: ['items'],
    },
  },
  {
    id: 'logic.filter',
    category: 'logic',
    name: 'Filtrar (continua só se)',
    icon: '🚦',
    description: 'Avalia condição. Se passa, continua. Se falha, termina a automação sem erro.',
    configSchema: {
      type: 'object',
      properties: {
        left: {},
        operator: { type: 'string', enum: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'contains', 'starts_with', 'ends_with', 'in', 'is_empty', 'is_not_empty'] },
        right: {},
      },
      required: ['left', 'operator'],
    },
  },
  {
    id: 'logic.wait_humanized',
    category: 'logic',
    name: 'Esperar (humanizado)',
    icon: '🌤️',
    description: 'Espera aleatório entre min e max segundos. Nunca Domingos. Sáb 9h-13h. Seg-Sex 8h-21h Lisboa.',
    configSchema: {
      type: 'object',
      properties: {
        min_seconds: { type: 'integer', minimum: 1 },
        max_seconds: { type: 'integer', minimum: 1 },
      },
      required: ['min_seconds', 'max_seconds'],
    },
  },
  {
    id: 'data.set_variable',
    category: 'data',
    name: 'Guardar variável',
    icon: '📥',
    description: 'Guarda um valor numa variável reutilizável a jusante via {{ este_no.output.value }}.',
    configSchema: {
      type: 'object',
      properties: {
        value: {},
      },
      required: ['value'],
    },
  },
  {
    id: 'data.format_text',
    category: 'data',
    name: 'Formatar texto',
    icon: '🧾',
    description: 'Gera texto formatado com {{ variáveis }} Liquid. Resultado em {{ este_no.output.text }}.',
    configSchema: {
      type: 'object',
      properties: {
        template: { type: 'string' },
      },
      required: ['template'],
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
