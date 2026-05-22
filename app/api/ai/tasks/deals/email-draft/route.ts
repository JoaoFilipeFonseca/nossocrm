import { generateText } from 'ai';
import { runWithAIFallback } from '@/lib/ai/run-with-fallback';
import { z } from 'zod';
import { requireAITaskContext, AITaskHttpError } from '@/lib/ai/tasks/server';
import { GenerateEmailDraftInputSchema } from '@/lib/ai/tasks/schemas';
import { getResolvedPrompt } from '@/lib/ai/prompts/server';
import { buildCachedSystem, flattenSystem, logCacheStats } from '@/lib/ai/cache';
import { isAIFeatureEnabled } from '@/lib/ai/features/server';

export const maxDuration = 60;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });
}

/**
 * Handler HTTP `POST` deste endpoint (Next.js Route Handler).
 *
 * @param {Request} req - Objeto da requisição.
 * @returns {Promise<Response>} Retorna um valor do tipo `Promise<Response>`.
 */
export async function POST(req: Request) {
  try {
    const { model, fallbackModel, supabase, organizationId, provider, fallbackProvider } = await requireAITaskContext(req);
    const enabled = await isAIFeatureEnabled(supabase as any, organizationId, 'ai_email_draft');
    if (!enabled) {
      return json({ error: { code: 'AI_FEATURE_DISABLED', message: 'Função de IA desativada: Rascunho de e-mail.' } }, 403);
    }

    const body = await req.json().catch(() => null);
    const { deal } = GenerateEmailDraftInputSchema.parse(body);

    // Prompt caching: separa system (estático, cached) de user (dados dinâmicos).
    // Variáveis {{...}} no template são substituídas por marcador para manter system estável.
    const resolved = await getResolvedPrompt(supabase, organizationId, 'task_deals_email_draft');
    const featurePrompt = (resolved?.content || '').replace(/\{\{\s*[\w.]+\s*\}\}/g, '[ver dados fornecidos no fim]');

    const userMessage = `Dados deste deal:\n- Contacto: ${deal?.contactName || 'Cliente'}\n- Empresa: ${deal?.companyName || ''}\n- Deal: ${deal?.title || ''}\n\nGera o rascunho de email conforme as regras acima.`;

    const cachedBlocks = buildCachedSystem(featurePrompt);
    const systemForPrimary = provider === 'anthropic' ? cachedBlocks : flattenSystem(cachedBlocks);
    const systemForFallback = fallbackProvider === 'anthropic' ? cachedBlocks : flattenSystem(cachedBlocks);

    const { result, via } = await runWithAIFallback(
      () => generateText({ model, maxRetries: 3, system: systemForPrimary as never, prompt: userMessage }),
      fallbackModel ? () => generateText({ model: fallbackModel, maxRetries: 1, system: systemForFallback as never, prompt: userMessage }) : null,
    );

    logCacheStats(`email-draft via=${via} provider=${via === 'primary' ? provider : fallbackProvider}`, result);

    return json({ text: result.text });
  } catch (err: unknown) {
    if (err instanceof AITaskHttpError) return err.toResponse();
    if (err instanceof z.ZodError) {
      return json({ error: { code: 'INVALID_INPUT', message: 'Payload inválido.' } }, 400);
    }

    console.error('[api/ai/tasks/deals/email-draft] Error:', err);
    return json({ error: { code: 'INTERNAL_ERROR', message: 'Erro ao gerar rascunho de e-mail.' } }, 500);
  }
}
