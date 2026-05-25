// Route Handler for AI "actions" (RPC-style helpers)
//
// This is the supported non-streaming endpoint for UI features that need a single, direct
// AI result (e.g. email draft, board generation, daily briefing).
//
// IMPORTANT:
// - Auth is cookie-based (Supabase SSR).
// - API keys are read server-side from `organization_settings`.
// - This is NOT the streaming Agent chat endpoint; that one is `/api/ai/chat`.
//
// Contract:
// POST { action: string, data: object }
// -> 200 { result?: any, error?: string, consentType?: string, retryAfter?: number }

import { generateText, Output } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { getModel, type AIProvider } from '@/lib/ai/config';
import { SECURITY_PREAMBLE } from '@/lib/ai/agent/agent.service';
import { sanitizeIncomingMessage } from '@/lib/ai/agent/input-filter';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isAllowedOrigin } from '@/lib/security/sameOrigin';
import { getResolvedPrompt } from '@/lib/ai/prompts/server';
import { renderPromptTemplate } from '@/lib/ai/prompts/render';
import { buildCachedSystem, flattenSystem, logCacheStats } from '@/lib/ai/cache';
import { isAIFeatureEnabled } from '@/lib/ai/features/server';
import { sanitizeCopy, sanitizeCopyObject } from '@/lib/ai/sanitize';

// Wrapper de timeout para Promise.race com early-give-up.
// Se a promessa não resolver dentro de `ms`, rejeita para activar fallback.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label}_TIMEOUT_${ms}ms`)), ms)),
  ]);
}

/**
 * Helper unificado para chamadas IA: Gemini com timeout + fallback Anthropic Haiku.
 *
 * Substitui ~9 cópias de `generateText({ model, ... })` boilerplate por chamada única.
 * Robustez transversal: nenhum endpoint fica stuck >12s, fallback automático em erros 5xx/timeout.
 *
 * @param geminiModel Modelo Gemini já configurado (de getModel)
 * @param anthropicKey Chave Anthropic se disponível (null = sem fallback)
 * @param system System prompt (string) — incluí GLOBAL_RULES_BLOCK quando relevante via buildCachedSystem+flattenSystem
 * @param prompt User message
 * @param outputSchema Schema opcional Zod para Output.object (gera output estruturado)
 * @param label Para logs (identifica o endpoint)
 * @param geminiTimeoutMs Default 12s
 */
async function runWithFallback(opts: {
  geminiModel: ReturnType<typeof getModel>;
  anthropicKey?: string | null;
  system: string;
  prompt: string;
  outputSchema?: z.ZodSchema<any>;
  label: string;
  geminiTimeoutMs?: number;
}): Promise<{ result: any; providerUsed: string; totalMs: number }> {
  const { geminiModel, anthropicKey, system, prompt, outputSchema, label } = opts;
  const timeoutMs = opts.geminiTimeoutMs ?? 12000;
  const startedAt = Date.now();
  const baseArgs: any = { system, prompt, maxRetries: 1 };
  if (outputSchema) baseArgs.output = Output.object({ schema: outputSchema });

  let result: any;
  let providerUsed = 'google';

  try {
    result = await withTimeout(
      generateText({ model: geminiModel, ...baseArgs }),
      timeoutMs,
      `${label}-gemini`
    );
  } catch (err: any) {
    const elapsed = Date.now() - startedAt;
    console.warn(`[${label}] Gemini falhou após ${elapsed}ms (${err?.message}). Fallback Anthropic.`);

    if (!anthropicKey) throw err;

    const anthropicProvider = createAnthropic({ apiKey: anthropicKey });
    const claudeModel = anthropicProvider('claude-haiku-4-5-20251001');
    result = await generateText({ model: claudeModel, ...baseArgs });
    providerUsed = 'anthropic-haiku';
  }

  // Sanitização em-dash corre nos callsites cliente (parseRewriteStreamText,
  // rewriteMessageDraft, execActionWhatsApp, etc.). NÃO sanitizar aqui — o
  // AI SDK retorna result.text como getter readonly e mutar lança em runtime.

  const totalMs = Date.now() - startedAt;
  logCacheStats(`${label} provider=${providerUsed} totalMs=${totalMs}`, result);
  return { result, providerUsed, totalMs };
}

export const maxDuration = 60;

type AIActionResponse<T = unknown> = {
  result?: T;
  error?: string;
  consentType?: string;
  retryAfter?: number;
};

type AIAction =
  | 'analyzeLead'
  | 'generateEmailDraft'
  | 'rewriteMessageDraft'
  | 'generateObjectionResponse'
  | 'generateDailyBriefing'
  | 'generateRescueMessage'
  | 'parseNaturalLanguageAction'
  | 'chatWithCRM'
  | 'generateBirthdayMessage'
  | 'generateBoardStructure'
  | 'generateBoardStrategy'
  | 'refineBoardWithAI'
  | 'chatWithBoardAgent'
  | 'generateSalesScript';

const AnalyzeLeadSchema = z.object({
  action: z.string().max(50).describe('Ação curta e direta, máximo 50 caracteres.'),
  reason: z.string().max(80).describe('Razão breve, máximo 80 caracteres.'),
  actionType: z.enum(['CALL', 'MEETING', 'EMAIL', 'TASK', 'WHATSAPP']).describe('Tipo de ação sugerida'),
  urgency: z.enum(['low', 'medium', 'high']).describe('Urgência da ação'),
  probabilityScore: z.number().min(0).max(100).describe('Score de probabilidade (0-100)'),
});

const BoardStructureSchema = z.object({
  boardName: z.string().describe('Nome do board em português'),
  description: z.string().describe('Descrição do propósito do board'),
  stages: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      color: z.string().describe('Classe Tailwind CSS, ex: bg-blue-500'),
      linkedLifecycleStage: z.string().describe('ID do lifecycle stage: LEAD, MQL, PROSPECT, CUSTOMER ou OTHER'),
      estimatedDuration: z.string().optional(),
    })
  ),
  automationSuggestions: z.array(z.string()),
});

const BoardStrategySchema = z.object({
  goal: z.object({
    description: z.string(),
    kpi: z.string(),
    targetValue: z.string(),
  }),
  agentPersona: z.object({
    name: z.string(),
    role: z.string(),
    behavior: z.string(),
  }),
  entryTrigger: z.string(),
});

const RefineBoardSchema = z.object({
  message: z.string().describe('Resposta conversacional explicando mudanças'),
  board: BoardStructureSchema.nullable().describe('Board modificado ou null se apenas pergunta'),
});

const ObjectionResponseSchema = z.array(z.string()).describe('3 respostas diferentes para contornar objeção');

const ParsedActionSchema = z.object({
  title: z.string(),
  type: z.enum(['CALL', 'MEETING', 'EMAIL', 'TASK']),
  date: z.string().optional(),
  contactName: z.string().optional(),
  companyName: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

const RewriteMessageDraftSchema = z.object({
  subject: z
    .string()
    .max(120)
    .optional()
    .describe('Assunto do email (somente para canal EMAIL).'),
  message: z
    .string()
    .max(1600)
    .describe('Mensagem final para enviar no canal escolhido.'),
});

function logAIAction(
  supabase: Awaited<ReturnType<typeof createClient>>,
  orgId: string,
  action: string,
  modelId: string,
  result: { usage?: { totalTokens?: number }; text?: string }
): void {
  void (supabase as any).from('ai_conversation_log').insert({
    organization_id: orgId,
    ai_response: (result.text || '').slice(0, 1000),
    tokens_used: result.usage?.totalTokens ?? 0,
    model_used: modelId,
    action_taken: action,
    context_snapshot: {},
  }).then(({ error }: { error: unknown }) => {
    if (error) console.error('[AI] log failed:', error);
  });
}

function safeContextText(v: unknown, maxBytes = 80_000): string {
  if (v == null) return '';
  try {
    const text = typeof v === 'string' ? v : JSON.stringify(v);
    if (text.length <= maxBytes) return text;
    return text.slice(0, maxBytes) + '\n... [TRUNCADO]';
  } catch {
    return '';
  }
}

// Remove rótulos internos do CRM ([Calculadora], [Proprietários], "Deal - ", etc.) antes de enviar ao LLM
function stripInternalLabels(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/\s*\[(?:Calculadora|Comparadores|Vendedores|Proprietarios|Propriet[áa]rios|Compradores|Arrendamento|Parceiros|Pipeline|Quiz|FSBO|Lead)\]\s*/gi, ' ')
    .replace(/^Deal\s*-\s*/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function fmtDateRel(iso: string | null | undefined): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    const dateStr = d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
    if (days === 0) return `hoje (${dateStr})`;
    if (days === 1) return `ontem (${dateStr})`;
    if (days < 30) return `há ${days} dias (${dateStr})`;
    return dateStr;
  } catch { return String(iso); }
}

// Constrói user message ESTRUTURADO (secções) em vez de JSON blob.
// LLM consegue extrair factos concretos sem ter que parsear JSON inline.
function buildRewriteUserMessage(args: {
  channelLabel: string;
  subject: string;
  message: string;
  snapshot: any;
  nba: any;
}): string {
  const { channelLabel, subject, message, snapshot, nba } = args;
  const lines: string[] = [];

  lines.push(`== CANAL ==\n${channelLabel}`);

  if (subject || message) {
    lines.push('\n== RASCUNHO ACTUAL (a melhorar) ==');
    if (subject) lines.push(`Assunto: ${subject}`);
    if (message) lines.push(`Mensagem:\n${message}`);
  } else {
    lines.push('\n== RASCUNHO ACTUAL ==\n[sem rascunho — gera mensagem nova do zero]');
  }

  const deal = snapshot?.deal;
  if (deal) {
    const title = stripInternalLabels(deal.title || '');
    const valorFmt = typeof deal.value === 'number' && deal.value > 0
      ? `${deal.value.toLocaleString('pt-PT')} €`
      : '';
    lines.push('\n== DEAL ==');
    if (title) lines.push(`- Assunto: ${title}`);
    if (snapshot?.stage?.label) lines.push(`- Fase do funil: ${snapshot.stage.label}`);
    if (snapshot?.board?.name) lines.push(`- Pipeline: ${snapshot.board.name}`);
    if (valorFmt) lines.push(`- Valor: ${valorFmt}`);
    if (snapshot?.cockpitSignals?.daysInStage != null) lines.push(`- Dias nesta fase: ${snapshot.cockpitSignals.daysInStage}`);
    if (snapshot?.cockpitSignals?.healthScore != null) lines.push(`- Health score: ${snapshot.cockpitSignals.healthScore}/100`);
  }

  const c = snapshot?.contact;
  if (c) {
    lines.push('\n== CONTACTO ==');
    if (c.name) lines.push(`- Nome: ${c.name}`);
    if (c.email) lines.push(`- Email: ${c.email}`);
    if (c.source) lines.push(`- Fonte do lead: ${c.source}`);
    if (c.lastInteraction) lines.push(`- Última interacção registada: ${fmtDateRel(c.lastInteraction)}`);
    if (c.notes) lines.push(`- Notas do contacto: ${String(c.notes).slice(0, 250)}`);
  }

  const acts = snapshot?.lists?.activities?.preview;
  if (Array.isArray(acts) && acts.length > 0) {
    lines.push('\n== HISTÓRICO RECENTE (últimas 5) ==');
    acts.slice(0, 5).forEach((a: any, i: number) => {
      const raw = stripInternalLabels(a.title || a.description || a.type || '');
      const t = raw.slice(0, 150);
      lines.push(`${i + 1}. [${fmtDateRel(a.date)}] ${a.type || ''} ${t}`.trim());
    });
  }

  const notes = snapshot?.lists?.notes?.preview;
  if (Array.isArray(notes) && notes.length > 0) {
    lines.push('\n== NOTAS RELEVANTES (últimas 3) ==');
    notes.slice(0, 3).forEach((n: any, i: number) => {
      const txt = String(n.content || '').slice(0, 200);
      lines.push(`${i + 1}. [${fmtDateRel(n.created_at)}] ${txt}`);
    });
  }

  if (nba) {
    const action = nba.action || nba.title;
    const reason = nba.reason;
    if (action) {
      lines.push('\n== PRÓXIMA ACÇÃO SUGERIDA (hint, não copiar literal) ==');
      lines.push(`- Acção: ${action}`);
      if (reason) lines.push(`- Razão: ${reason}`);
    }
  }

  lines.push(`\n== INSTRUÇÃO ==\n${
    subject || message
      ? `Melhora a mensagem acima para ${channelLabel}, mantendo o conteúdo essencial mas aplicando o estilo profissional pt-PT formal do João Fonseca conforme as regras do system. Usa os dados do deal e do histórico para personalizar com factos concretos.`
      : `Cria uma mensagem nova para ${channelLabel} usando os dados acima. Aplica o estilo profissional pt-PT formal do João Fonseca conforme as regras do system. Personaliza com 1-2 factos concretos do deal ou do histórico.`
  }`);

  return lines.join('\n');
}

function json<T>(body: T, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

/**
 * Handler HTTP `POST` deste endpoint (Next.js Route Handler).
 *
 * @param {Request} req - Objeto da requisição.
 * @returns {Promise<Response>} Retorna um valor do tipo `Promise<Response>`.
 */
export async function POST(req: Request) {
  // Mitigação CSRF: bloqueia POST cross-site em endpoint que usa auth via cookies.
  if (!isAllowedOrigin(req)) {
    return json<AIActionResponse>({ error: 'Forbidden' }, 403);
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return json<AIActionResponse>({ error: 'Unauthorized' }, 401);
  }

  const body = await req.json().catch(() => null);
  const action = body?.action as AIAction | undefined;
  const data = (body?.data ?? {}) as Record<string, unknown>;

  if (!action) {
    return json<AIActionResponse>({ error: "Invalid request format. Missing 'action'." }, 400);
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('organization_id')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.organization_id) {
    return json<AIActionResponse>({ error: 'Profile not found' }, 404);
  }

  const { data: orgSettings, error: orgError } = await supabase
    .from('organization_settings')
    .select('ai_enabled, ai_model, ai_google_key, ai_anthropic_key')
    .eq('organization_id', profile.organization_id)
    .single();

  const aiEnabled = typeof (orgSettings as any)?.ai_enabled === 'boolean' ? (orgSettings as any).ai_enabled : true;
  if (!aiEnabled) {
    return json<AIActionResponse>(
      { error: 'IA desativada pela organização. Um admin pode ativar em Configurações → Central de I.A.' },
      403
    );
  }

  // Feature flag per action (default: enabled)
  const featureKeyByAction: Partial<Record<AIAction, string>> = {
    analyzeLead: 'ai_deal_analyze',
    generateEmailDraft: 'ai_email_draft',
    generateObjectionResponse: 'ai_objection_responses',
    generateDailyBriefing: 'ai_daily_briefing',
    generateSalesScript: 'ai_sales_script',
    generateBoardStructure: 'ai_board_generate_structure',
    generateBoardStrategy: 'ai_board_generate_strategy',
    refineBoardWithAI: 'ai_board_refine',
    chatWithBoardAgent: 'ai_chat_agent',
    chatWithCRM: 'ai_chat_agent',
    rewriteMessageDraft: 'ai_email_draft',
  };

  const featureKey = featureKeyByAction[action];
  if (featureKey) {
    const enabled = await isAIFeatureEnabled(supabase as any, profile.organization_id as any, featureKey);
    if (!enabled) {
      return json<AIActionResponse>(
        { error: `Função de IA desativada para esta ação (${action}).` },
        403
      );
    }
  }

  // Frontend expects "AI consent required" as a *payload* error.
  const provider: AIProvider = 'google';
  const apiKey: string | null = orgSettings?.ai_google_key ?? null;

  if (orgError || !apiKey) {
    return json<AIActionResponse>({ error: 'AI consent required', consentType: 'AI_CONSENT' }, 200);
  }

  const modelId = orgSettings.ai_model || '';
  const model = getModel(provider, apiKey, modelId);

  try {
    switch (action) {
      case 'analyzeLead': {
        const { deal, stageLabel } = data as any;
        const resolved = await getResolvedPrompt(supabase as any, profile.organization_id as any, 'task_deals_analyze');
        const prompt = renderPromptTemplate(resolved?.content || '', {
          dealTitle: deal?.title || '',
          dealValue: deal?.value?.toLocaleString?.('pt-PT') ?? deal?.value ?? 0,
          stageLabel: stageLabel || deal?.status || '',
          probability: deal?.probability || 50,
        });
        const { result, providerUsed } = await runWithFallback({
          geminiModel: model,
          anthropicKey: (orgSettings as any)?.ai_anthropic_key,
          system: SECURITY_PREAMBLE,
          prompt,
          outputSchema: AnalyzeLeadSchema,
          label: 'analyzeLead',
        });
        logAIAction(supabase, profile.organization_id, 'analyzeLead', `${modelId}|${providerUsed}`, result);
        return json<AIActionResponse>({ result: result.output });
      }

      case 'generateEmailDraft': {
        const { deal } = data as any;
        const resolved = await getResolvedPrompt(supabase as any, profile.organization_id as any, 'task_deals_email_draft');
        // B-004: template BD espera {{deal}}, {{contact}}, {{context}} — não {{dealTitle}}/{{contactName}}.
        // Mapear callsite vars → template vars. Para contexto rico usar /api/ai/actions/stream (rewriteMessageDraft).
        const contactStr = deal?.contactName
          ? `${deal.contactName}${deal?.companyName ? ` (empresa: ${deal.companyName})` : ''}`
          : 'Cliente';
        const prompt = renderPromptTemplate(resolved?.content || '', {
          deal: deal?.title || '',
          contact: contactStr,
          context: '[contexto rico não disponível neste endpoint — para draft com histórico+activities+notes usa rewriteMessageDraft no Inbox→Foco]',
        });
        const { result, providerUsed } = await runWithFallback({
          geminiModel: model,
          anthropicKey: (orgSettings as any)?.ai_anthropic_key,
          system: SECURITY_PREAMBLE,
          prompt,
          label: 'generateEmailDraft',
        });
        logAIAction(supabase, profile.organization_id, 'generateEmailDraft', `${modelId}|${providerUsed}`, result);
        return json<AIActionResponse>({ result: result.text });
      }

      case 'rewriteMessageDraft': {
        const {
          channel,
          currentSubject,
          currentMessage,
          nextBestAction,
          cockpitSnapshot,
        } = data as any;

        const channelLabel = channel === 'EMAIL' ? 'EMAIL' : 'WHATSAPP';
        const { text: safeMessage } = sanitizeIncomingMessage(String(currentMessage || ''), { org_id: profile.organization_id });
        const { text: safeSubject } = sanitizeIncomingMessage(String(currentSubject || ''), { org_id: profile.organization_id });

        // System: prompt v3 da BD (rewrite_message_draft) + GLOBAL_RULES_BLOCK
        const resolved = await getResolvedPrompt(supabase as any, profile.organization_id as any, 'rewrite_message_draft');
        const featurePrompt = resolved?.content || '';
        const cachedBlocks = buildCachedSystem(featurePrompt);
        const systemFlat = flattenSystem(cachedBlocks);  // Para Gemini (implicit caching)

        // User: dados estruturados truncados (max ~3KB)
        const userMessage = buildRewriteUserMessage({
          channelLabel,
          subject: safeSubject,
          message: safeMessage,
          snapshot: cockpitSnapshot,
          nba: nextBestAction,
        });

        // Usa helper unificado: Gemini com timeout 12s + fallback Anthropic Haiku.
        const { result, providerUsed } = await runWithFallback({
          geminiModel: model,
          anthropicKey: (orgSettings as any)?.ai_anthropic_key,
          system: systemFlat,
          prompt: userMessage,
          outputSchema: RewriteMessageDraftSchema,
          label: `rewriteMessageDraft channel=${channelLabel}`,
        });
        logAIAction(supabase, profile.organization_id, 'rewriteMessageDraft', `${modelId}|${providerUsed}`, result);
        return json<AIActionResponse>({ result: result.output });
      }

      case 'generateRescueMessage': {
        const { deal, channel } = data as any;
        const { result, providerUsed } = await runWithFallback({
          geminiModel: model,
          anthropicKey: (orgSettings as any)?.ai_anthropic_key,
          system: SECURITY_PREAMBLE,
          prompt: `Gere uma mensagem de resgate/follow-up para reativar um deal parado.
DEAL: ${deal?.title} (${deal?.contactName || ''})
CANAL: ${channel}
Responda em português europeu (pt-PT) formal.`,
          label: 'generateRescueMessage',
        });
        logAIAction(supabase, profile.organization_id, 'generateRescueMessage', `${modelId}|${providerUsed}`, result);
        return json<AIActionResponse>({ result: result.text });
      }

      case 'generateBoardStructure': {
        const { description, lifecycleStages } = data as any;
        const { text: safeDescription } = sanitizeIncomingMessage(String(description || ''), { org_id: profile.organization_id });
        const lifecycleList =
          Array.isArray(lifecycleStages) && lifecycleStages.length > 0
            ? lifecycleStages.map((s: any) => ({ id: s?.id || '', name: s?.name || String(s) }))
            : [
                { id: 'LEAD', name: 'Lead' },
                { id: 'MQL', name: 'MQL' },
                { id: 'PROSPECT', name: 'Oportunidade' },
                { id: 'CUSTOMER', name: 'Cliente' },
                { id: 'OTHER', name: 'Outros' },
              ];

        const resolved = await getResolvedPrompt(supabase as any, profile.organization_id as any, 'task_boards_generate_structure');
        const prompt = renderPromptTemplate(resolved?.content || '', {
          description: safeDescription,
          lifecycleJson: JSON.stringify(lifecycleList),
        });
        const { result, providerUsed } = await runWithFallback({
          geminiModel: model,
          anthropicKey: (orgSettings as any)?.ai_anthropic_key,
          system: SECURITY_PREAMBLE,
          prompt,
          outputSchema: BoardStructureSchema,
          label: 'generateBoardStructure',
        });
        logAIAction(supabase, profile.organization_id, 'generateBoardStructure', `${modelId}|${providerUsed}`, result);
        return json<AIActionResponse>({ result: result.output });
      }

      case 'generateBoardStrategy': {
        const { boardData } = data as any;
        const resolved = await getResolvedPrompt(supabase as any, profile.organization_id as any, 'task_boards_generate_strategy');
        const prompt = renderPromptTemplate(resolved?.content || '', {
          boardName: boardData?.boardName || '',
        });
        const { result, providerUsed } = await runWithFallback({
          geminiModel: model,
          anthropicKey: (orgSettings as any)?.ai_anthropic_key,
          system: SECURITY_PREAMBLE,
          prompt,
          outputSchema: BoardStrategySchema,
          label: 'generateBoardStrategy',
        });
        logAIAction(supabase, profile.organization_id, 'generateBoardStrategy', `${modelId}|${providerUsed}`, result);
        return json<AIActionResponse>({ result: result.output });
      }

      case 'refineBoardWithAI': {
        const { currentBoard, userInstruction, chatHistory } = data as any;
        const { text: safeInstruction } = sanitizeIncomingMessage(String(userInstruction || ''), { org_id: profile.organization_id });
        const historyContext = chatHistory ? `\nHistórico:\n${JSON.stringify(chatHistory)}` : '';
        const boardContext = currentBoard
          ? `\nBoard atual (JSON):\n${JSON.stringify(currentBoard)}`
          : '';
        const resolved = await getResolvedPrompt(supabase as any, profile.organization_id as any, 'task_boards_refine');
        const prompt = renderPromptTemplate(resolved?.content || '', {
          userInstruction: safeInstruction,
          boardContext,
          historyContext,
        });
        const { result, providerUsed } = await runWithFallback({
          geminiModel: model,
          anthropicKey: (orgSettings as any)?.ai_anthropic_key,
          system: SECURITY_PREAMBLE,
          prompt,
          outputSchema: RefineBoardSchema,
          label: 'refineBoardWithAI',
        });
        logAIAction(supabase, profile.organization_id, 'refineBoardWithAI', `${modelId}|${providerUsed}`, result);
        return json<AIActionResponse>({ result: result.output });
      }

      case 'generateObjectionResponse': {
        const { deal, objection } = data as any;
        const resolved = await getResolvedPrompt(supabase as any, profile.organization_id as any, 'task_deals_objection_responses');
        const prompt = renderPromptTemplate(resolved?.content || '', {
          objection,
          dealTitle: deal?.title || '',
        });
        const { result, providerUsed } = await runWithFallback({
          geminiModel: model,
          anthropicKey: (orgSettings as any)?.ai_anthropic_key,
          system: SECURITY_PREAMBLE,
          prompt,
          outputSchema: ObjectionResponseSchema,
          label: 'generateObjectionResponse',
        });
        logAIAction(supabase, profile.organization_id, 'generateObjectionResponse', `${modelId}|${providerUsed}`, result);
        return json<AIActionResponse>({ result: result.output });
      }

      case 'parseNaturalLanguageAction': {
        const { text } = data as any;
        const { text: safeText } = sanitizeIncomingMessage(String(text || ''), { org_id: profile.organization_id });
        const { result, providerUsed } = await runWithFallback({
          geminiModel: model,
          anthropicKey: (orgSettings as any)?.ai_anthropic_key,
          system: SECURITY_PREAMBLE,
          prompt: `Parse para CRM Action: "${safeText}".\nCampos: title, type (CALL/MEETING/EMAIL/TASK), date, contactName, companyName, confidence.`,
          outputSchema: ParsedActionSchema,
          label: 'parseNaturalLanguageAction',
        });
        logAIAction(supabase, profile.organization_id, 'parseNaturalLanguageAction', `${modelId}|${providerUsed}`, result);
        return json<AIActionResponse>({ result: result.output });
      }

      case 'chatWithCRM': {
        const { message, context } = data as any;
        const { text: safeMsg } = sanitizeIncomingMessage(String(message || ''), { org_id: profile.organization_id });
        const { result, providerUsed } = await runWithFallback({
          geminiModel: model,
          anthropicKey: (orgSettings as any)?.ai_anthropic_key,
          system: SECURITY_PREAMBLE,
          prompt: `Assistente CRM.
Contexto: ${JSON.stringify(context)}
Utilizador: ${safeMsg}
Responda em português europeu (pt-PT) formal.`,
          label: 'chatWithCRM',
        });
        logAIAction(supabase, profile.organization_id, 'chatWithCRM', `${modelId}|${providerUsed}`, result);
        return json<AIActionResponse>({ result: result.text });
      }

      case 'generateBirthdayMessage': {
        const { contactName, age } = data as any;
        const { result, providerUsed } = await runWithFallback({
          geminiModel: model,
          anthropicKey: (orgSettings as any)?.ai_anthropic_key,
          system: SECURITY_PREAMBLE,
          prompt: `Parabéns para ${contactName} (${age || ''} anos). Curto, profissional, pt-PT formal.`,
          label: 'generateBirthdayMessage',
        });
        logAIAction(supabase, profile.organization_id, 'generateBirthdayMessage', `${modelId}|${providerUsed}`, result);
        return json<AIActionResponse>({ result: result.text });
      }

      case 'generateDailyBriefing': {
        const resolved = await getResolvedPrompt(supabase as any, profile.organization_id as any, 'task_inbox_daily_briefing');
        const prompt = renderPromptTemplate(resolved?.content || '', {
          dataJson: JSON.stringify(data),
        });
        const { result, providerUsed } = await runWithFallback({
          geminiModel: model,
          anthropicKey: (orgSettings as any)?.ai_anthropic_key,
          system: SECURITY_PREAMBLE,
          prompt,
          label: 'generateDailyBriefing',
        });
        logAIAction(supabase, profile.organization_id, 'generateDailyBriefing', `${modelId}|${providerUsed}`, result);
        return json<AIActionResponse>({ result: result.text });
      }

      case 'chatWithBoardAgent': {
        const { message, boardContext } = data as any;
        const { text: safeMsg } = sanitizeIncomingMessage(String(message || ''), { org_id: profile.organization_id });
        const { result, providerUsed } = await runWithFallback({
          geminiModel: model,
          anthropicKey: (orgSettings as any)?.ai_anthropic_key,
          system: SECURITY_PREAMBLE,
          prompt: `Persona: ${boardContext?.agentName}. Contexto: ${JSON.stringify(boardContext)}. Msg: ${safeMsg}`,
          label: 'chatWithBoardAgent',
        });
        logAIAction(supabase, profile.organization_id, 'chatWithBoardAgent', `${modelId}|${providerUsed}`, result);
        return json<AIActionResponse>({ result: result.text });
      }

      case 'generateSalesScript': {
        const { deal, scriptType, context } = data as any;
        const resolved = await getResolvedPrompt(supabase as any, profile.organization_id as any, 'task_inbox_sales_script');
        const prompt = renderPromptTemplate(resolved?.content || '', {
          scriptType: scriptType || 'geral',
          dealTitle: deal?.title || '',
          context: context || '',
        });
        const { result, providerUsed } = await runWithFallback({
          geminiModel: model,
          anthropicKey: (orgSettings as any)?.ai_anthropic_key,
          system: SECURITY_PREAMBLE,
          prompt,
          label: 'generateSalesScript',
        });
        logAIAction(supabase, profile.organization_id, 'generateSalesScript', `${modelId}|${providerUsed}`, result);
        return json<AIActionResponse>({ result: { script: result.text, scriptType, generatedFor: deal?.title } });
      }

      default: {
        const exhaustive: never = action;
        return json<AIActionResponse>({ error: `Unknown action: ${exhaustive}` }, 200);
      }
    }
  } catch (err: any) {
    console.error('[api/ai/actions] Error:', err);
    return json<AIActionResponse>({ error: err?.message || 'Internal Server Error' }, 200);
  }
}
