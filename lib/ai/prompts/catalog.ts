export type PromptCatalogItem = {
  /** Key estÃ¡vel usado pelo cÃ³digo para buscar o prompt */
  key: string;
  /** Nome humano na UI */
  title: string;
  /** Onde esse prompt Ã© usado (para auditoria/descoberta) */
  usedBy: string[];
  /** Template padrÃ£o (fallback) */
  defaultTemplate: string;
  /** Ajuda/observaÃ§Ãµes para quem vai editar */
  notes?: string;
};

/**
 * CatÃ¡logo de prompts âdefaultâ do sistema.
 * - A Central de I.A lista tudo daqui.
 * - O backend pode sobrescrever via `ai_prompt_templates` (override por organizaÃ§Ã£o).
 */
export const PROMPT_CATALOG: PromptCatalogItem[] = [
  {
    key: 'task_inbox_sales_script',
    title: 'Inbox Â· Script de vendas',
    usedBy: ['app/api/ai/tasks/inbox/sales-script', 'app/api/ai/actions â generateSalesScript'],
    defaultTemplate:
      `Gere script de vendas ({{scriptType}}).\n` +
      `Deal: {{dealTitle}}. Contexto: {{context}}.\n` +
      `Seja natural, 4 parÃ¡grafos max. PortuguÃªs do Brasil.`,
    notes:
      'VariÃ¡veis: scriptType, dealTitle, context. Dica: mantenha curto para WhatsApp e evite jargÃµes.',
  },
  {
    key: 'task_inbox_daily_briefing',
    title: 'Inbox Â· Briefing diÃ¡rio',
    usedBy: ['app/api/ai/tasks/inbox/daily-briefing', 'app/api/ai/actions â generateDailyBriefing'],
    defaultTemplate: `Briefing diÃ¡rio. Dados: {{dataJson}}. Resuma prioridades em portuguÃªs do Brasil.`,
    notes: 'VariÃ¡veis: dataJson (JSON string).',
  },
  {
    key: 'task_deals_objection_responses',
    title: 'Deals Â· Respostas de objeÃ§Ã£o (3 opÃ§Ãµes)',
    usedBy: ['app/api/ai/tasks/deals/objection-responses', 'app/api/ai/actions â generateObjectionResponse'],
    defaultTemplate:
      `ObjeÃ§Ã£o: "{{objection}}" no deal "{{dealTitle}}".\n` +
      `Gere 3 respostas prÃ¡ticas (EmpÃ¡tica, Valor, Pergunta). PortuguÃªs do Brasil.`,
    notes: 'VariÃ¡veis: objection, dealTitle.',
  },
  {
    key: 'task_deals_email_draft',
    title: 'Deals Â· Rascunho de e-mail',
    usedBy: ['app/api/ai/tasks/deals/email-draft', 'app/api/ai/actions â generateEmailDraft'],
    defaultTemplate:
      `Gere um rascunho de email profissional para:\n` +
      `- Contato: {{contactName}}\n` +
      `- Empresa: {{companyName}}\n` +
      `- Deal: {{dealTitle}}\n` +
      `Escreva um email conciso e eficaz em portuguÃªs do Brasil.`,
    notes: 'VariÃ¡veis: contactName, companyName, dealTitle.',
  },
  {
    key: 'task_deals_analyze',
    title: 'Deals Â· AnÃ¡lise (coach) para prÃ³xima aÃ§Ã£o',
    usedBy: ['app/api/ai/tasks/deals/analyze', 'app/api/ai/actions â analyzeLead'],
    defaultTemplate:
      `VocÃª Ã© um coach de vendas analisando um deal de CRM. Seja DIRETO e ACIONÃVEL.\n` +
      `DEAL:\n` +
      `- TÃ­tulo: {{dealTitle}}\n` +
      `- Valor: R$ {{dealValue}}\n` +
      `- EstÃ¡gio: {{stageLabel}}\n` +
      `- Probabilidade: {{probability}}%\n` +
      `RETORNE:\n` +
      `1. action: Verbo no infinitivo + complemento curto (mÃ¡x 50 chars).\n` +
      `2. reason: Por que fazer isso AGORA (mÃ¡x 80 chars).\n` +
      `3. actionType: CALL, MEETING, EMAIL, TASK ou WHATSAPP\n` +
      `4. urgency: low, medium, high\n` +
      `5. probabilityScore: 0-100\n` +
      `Seja conciso. PortuguÃªs do Brasil.`,
    notes: 'VariÃ¡veis: dealTitle, dealValue, stageLabel, probability.',
  },
  {
    key: 'task_boards_generate_structure',
    title: 'Boards Â· Gerar estrutura de board (Kanban)',
    usedBy: ['app/api/ai/tasks/boards/generate-structure', 'app/api/ai/actions â generateBoardStructure'],
    defaultTemplate:
      `Crie uma estrutura de board Kanban para: {{description}}.\n` +
      `LIFECYCLES: {{lifecycleJson}}\n` +
      `Crie 4-7 estÃ¡gios com cores Tailwind. PortuguÃªs do Brasil.`,
    notes: 'VariÃ¡veis: description, lifecycleJson (JSON string).',
  },
  {
    key: 'task_boards_generate_strategy',
    title: 'Boards Â· Gerar estratÃ©gia (meta/KPI/persona)',
    usedBy: ['app/api/ai/tasks/boards/generate-strategy', 'app/api/ai/actions â generateBoardStrategy'],
    defaultTemplate:
      `Defina estratÃ©gia para board: {{boardName}}.\n` +
      `Meta, KPI, Persona. PortuguÃªs do Brasil.`,
    notes: 'VariÃ¡veis: boardName.',
  },
  {
    key: 'task_boards_refine',
    title: 'Boards Â· Refinar board com instruÃ§Ãµes (chat)',
    usedBy: ['app/api/ai/tasks/boards/refine', 'app/api/ai/actions â refineBoardWithAI'],
    defaultTemplate:
      `Ajuste o board com base na instruÃ§Ã£o: "{{userInstruction}}".\n` +
      `{{boardContext}}\n` +
      `{{historyContext}}\n` +
      `Se for conversa, retorne board: null.`,
    notes:
      'VariÃ¡veis: userInstruction, boardContext (texto), historyContext (texto). Deixe claro quando nÃ£o for pra alterar board.',
  },
  {
    key: 'agent_crm_base_instructions',
    title: 'Agente Â· System prompt base (CRM Pilot)',
    usedBy: ['lib/ai/crmAgent â BASE_INSTRUCTIONS', 'app/api/ai/chat'],
    defaultTemplate:
      `VocÃª Ã© o Foco Imo Pilot, um assistente de vendas inteligente. ð\n` +
      `\n` +
      `PERSONALIDADE:\n` +
      `- Seja proativo, amigÃ¡vel e analÃ­tico\n` +
      `- Use emojis com moderaÃ§Ã£o (mÃ¡ximo 2 por resposta)\n` +
      `- Respostas naturais (evite listas robÃ³ticas)\n` +
      `- MÃ¡ximo 2 parÃ¡grafos por resposta\n` +
      `\n` +
      `REGRAS:\n` +
      `- Sempre explique os resultados das ferramentas\n` +
      `- Se der erro, informe de forma amigÃ¡vel\n` +
      `- NÃ£o mostre IDs/UUIDs para o usuÃ¡rio final\n`,
    notes:
      'Importante: esse prompt Ã© âsensÃ­velâ. MudanÃ§as ruins degradam o agente e podem quebrar fluxos. Ideal ter versionamento e botÃ£o âresetâ.',
  },
];

/**
 * FunÃ§Ã£o pÃºblica `getPromptCatalogMap` do projeto.
 * @returns {Record<string, PromptCatalogItem>} Retorna um valor do tipo `Record<string, PromptCatalogItem>`.
 */
export function getPromptCatalogMap(): Record<string, PromptCatalogItem> {
  return Object.fromEntries(PROMPT_CATALOG.map((p) => [p.key, p]));
}

