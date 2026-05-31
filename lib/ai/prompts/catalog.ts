export type PromptCatalogItem = {
  /** Key estável usado pelo código para procurar o prompt */
  key: string;
  /** Nome humano na UI */
  title: string;
  /** Onde esse prompt é usado (para auditoria/descoberta) */
  usedBy: string[];
  /** Template padrão (fallback) */
  defaultTemplate: string;
  /** Ajuda/observações para quem vai editar */
  notes?: string;
};

/**
 * Catálogo de prompts “default” do sistema.
 * - A Central de I.A lista tudo daqui.
 * - O backend pode sobrescrever via `ai_prompt_templates` (override por organização).
 */
export const PROMPT_CATALOG: PromptCatalogItem[] = [
  {
    key: 'task_inbox_sales_script',
    title: 'Inbox · Script de vendas',
    usedBy: ['app/api/ai/tasks/inbox/sales-script', 'app/api/ai/actions → generateSalesScript'],
    defaultTemplate:
      `Gere script de vendas ({{scriptType}}).\n` +
      `Deal: {{dealTitle}}. Contexto: {{context}}.\n` +
      `Seja natural, 4 parágrafos max. Português europeu (pt-PT).`,
    notes:
      'Variáveis: scriptType, dealTitle, context. Dica: mantenha curto para WhatsApp e evite jargões.',
  },
  {
    key: 'task_inbox_daily_briefing',
    title: 'Inbox · Briefing diário',
    usedBy: ['app/api/ai/tasks/inbox/daily-briefing', 'app/api/ai/actions → generateDailyBriefing'],
    defaultTemplate: `Briefing diário. Dados: {{dataJson}}. Resuma prioridades em português do Portugal.`,
    notes: 'Variáveis: dataJson (JSON string).',
  },
  {
    key: 'task_deals_objection_responses',
    title: 'Deals · Respostas de objecção (3 opções)',
    usedBy: ['app/api/ai/tasks/deals/objection-responses', 'app/api/ai/actions → generateObjectionResponse'],
    defaultTemplate:
      `Objecção: "{{objection}}" no deal "{{dealTitle}}".\n` +
      `Gere 3 respostas práticas (Empática, Valor, Pergunta). Português europeu (pt-PT).`,
    notes: 'Variáveis: objection, dealTitle.',
  },
  {
    key: 'task_deals_email_draft',
    title: 'Deals · Rascunho de e-mail',
    usedBy: ['app/api/ai/tasks/deals/email-draft', 'app/api/ai/actions → generateEmailDraft'],
    defaultTemplate:
      `Gere um rascunho de email profissional para:\n` +
      `- Contacto: {{contactName}}\n` +
      `- Empresa: {{companyName}}\n` +
      `- Deal: {{dealTitle}}\n` +
      `Escreva um email conciso e eficaz em português do Portugal.`,
    notes: 'Variáveis: contactName, companyName, dealTitle.',
  },
  {
    key: 'task_deals_analyze',
    title: 'Deals · Análise (coach) para próxima acção',
    usedBy: ['app/api/ai/tasks/deals/analyze', 'app/api/ai/actions → analyzeLead'],
    defaultTemplate:
      `É um coach de vendas a analisar um deal de CRM. Seja DIRECTO e ACCIONÁVEL.\n` +
      `DEAL:\n` +
      `- Título: {{dealTitle}}\n` +
      `- Valor: {{dealValue} €}\n` +
      `- Estágio: {{stageLabel}}\n` +
      `- Probabilidade: {{probability}}%\n` +
      `RETORNE:\n` +
      `1. action: Verbo no infinitivo + complemento curto (máx 50 chars).\n` +
      `2. reason: Porquê fazer isto AGORA (máx 80 chars).\n` +
      `3. actionType: CALL, MEETING, EMAIL, TASK ou WHATSAPP\n` +
      `4. urgency: low, medium, high\n` +
      `5. probabilityScore: 0-100\n` +
      `Seja conciso. Português europeu (pt-PT).`,
    notes: 'Variáveis: dealTitle, dealValue, stageLabel, probability.',
  },
  {
    key: 'task_boards_generate_structure',
    title: 'Boards · Gerar estrutura de board (Kanban)',
    usedBy: ['app/api/ai/tasks/boards/generate-structure', 'app/api/ai/actions → generateBoardStructure'],
    defaultTemplate:
      `Crie uma estrutura de board Kanban para: {{description}}.\n` +
      `LIFECYCLES: {{lifecycleJson}}\n` +
      `Crie 4-7 estágios com cores Tailwind. Português europeu (pt-PT).`,
    notes: 'Variáveis: description, lifecycleJson (JSON string).',
  },
  {
    key: 'task_boards_generate_strategy',
    title: 'Boards · Gerar estratégia (meta/KPI/persona)',
    usedBy: ['app/api/ai/tasks/boards/generate-strategy', 'app/api/ai/actions → generateBoardStrategy'],
    defaultTemplate:
      `Defina estratégia para board: {{boardName}}.\n` +
      `Meta, KPI, Persona. Português europeu (pt-PT).`,
    notes: 'Variáveis: boardName.',
  },
  {
    key: 'task_boards_refine',
    title: 'Boards · Refinar board com instruções (chat)',
    usedBy: ['app/api/ai/tasks/boards/refine', 'app/api/ai/actions → refineBoardWithAI'],
    defaultTemplate:
      `Ajuste o board com base na instrução: "{{userInstruction}}".\n` +
      `{{boardContext}}\n` +
      `{{historyContext}}\n` +
      `Se for conversa, retorne board: null.`,
    notes:
      'Variáveis: userInstruction, boardContext (texto), historyContext (texto). Deixe claro quando não for para alterar board.',
  },
  {
    key: 'agent_crm_base_instructions',
    title: 'Agente · System prompt base (CRM Pilot)',
    usedBy: ['lib/ai/crmAgent → BASE_INSTRUCTIONS', 'app/api/ai/chat'],
    defaultTemplate:
      `És o Foco Imo Pilot, um assistente de vendas inteligente. 🚀\n` +
      `\n` +
      `PERSONALIDADE:\n` +
      `- Sê proactivo, amigável e analítico\n` +
      `- Use emojis com moderação (máximo 2 por resposta)\n` +
      `- Respostas naturais (evite listas robóticas)\n` +
      `- Máximo 2 parágrafos por resposta\n` +
      `\n` +
      `REGRAS:\n` +
      `- Sempre explique os resultados das ferramentas\n` +
      `- Se der erro, informe de forma amigável\n` +
      `- Não mostre IDs/UUIDs para o utilizador final\n`,
    notes:
      'Importante: este prompt é “sensível”. Mudanças más degradam o agente e podem quebrar fluxos. Ideal ter versionamento e botão “reset”.',
  },
];

/**
 * Função pública `getPromptCatalogMap` do projeto.
 * @returns {Record<string, PromptCatalogItem>} Retorna um valor do tipo `Record<string, PromptCatalogItem>`.
 */
export function getPromptCatalogMap(): Record<string, PromptCatalogItem> {
  return Object.fromEntries(PROMPT_CATALOG.map((p) => [p.key, p]));
}

