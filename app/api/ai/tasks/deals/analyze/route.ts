import { runWithAIFallback } from '@/lib/ai/run-with-fallback';
import { generateText, Output } from 'ai';
import { z } from 'zod';
import { requireAITaskContext, AITaskHttpError } from '@/lib/ai/tasks/server';
import { AnalyzeLeadInputSchema, AnalyzeLeadOutputSchema } from '@/lib/ai/tasks/schemas';
import { getResolvedPrompt } from '@/lib/ai/prompts/server';
import { renderPromptTemplate } from '@/lib/ai/prompts/render';
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
    const { model, fallbackModel, supabase, organizationId, modelId } = await requireAITaskContext(req);
    const enabled = await isAIFeatureEnabled(supabase as any, organizationId, 'ai_deal_analyze');
    if (!enabled) {
      return json({ error: { code: 'AI_FEATURE_DISABLED', message: 'Função de IA desativada: Análise de deal.' } }, 403);
    }

    const body = await req.json().catch(() => null);
    const { deal, stageLabel } = AnalyzeLeadInputSchema.parse(body);

    const value = deal?.value ?? 0;
    const formattedValue = typeof value === 'number' ? value.toLocaleString('pt-PT') : String(value);

    const resolved = await getResolvedPrompt(supabase, organizationId, 'task_deals_analyze');
    const prompt = renderPromptTemplate(resolved?.content || '', {
      dealTitle: deal?.title || '',
      dealValue: formattedValue,
      stageLabel: stageLabel || deal?.status || '',
      probability: deal?.probability || 50,
    });

    // A IA pode falhar (provedor 5xx/timeout) ou o modelo pode exceder os limites
    // apertados do schema (action ≤50, reason ≤80) e esgotar os retries. Antes isso
    // caía no catch geral → 500, que aparecia como toast de erro ao mudar de etapa.
    // Degradamos com graça: devolvemos uma sugestão neutra e determinista (200).
    let output: z.infer<typeof AnalyzeLeadOutputSchema>;
    try {
      const { result } = await runWithAIFallback(
        () => generateText({ model, maxRetries: 3, output: Output.object({ schema: AnalyzeLeadOutputSchema }), prompt }),
        fallbackModel ? () => generateText({ model: fallbackModel, maxRetries: 1, output: Output.object({ schema: AnalyzeLeadOutputSchema }), prompt }) : null,
      );
      output = result.output;

      void (supabase as any).from('ai_conversation_log').insert({
        organization_id: organizationId,
        ai_response: '',
        tokens_used: result.usage?.totalTokens ?? 0,
        model_used: modelId,
        action_taken: 'analyze_lead',
        context_snapshot: {},
      }).then(({ error }: { error: unknown }) => {
        if (error) console.error('[AI] log failed:', error);
      });
    } catch (aiErr) {
      console.error('[api/ai/tasks/deals/analyze] AI indisponível, fallback neutro:', aiErr);
      const prob = typeof deal?.probability === 'number' ? deal.probability : 50;
      output = {
        action: 'Dar o próximo passo no negócio',
        reason: 'Análise automática indisponível. Reveja e avance.',
        actionType: 'TASK',
        urgency: 'medium',
        probabilityScore: prob,
      };
    }

    return json(output);
  } catch (err: unknown) {
    if (err instanceof AITaskHttpError) return err.toResponse();
    if (err instanceof z.ZodError) {
      return json({ error: { code: 'INVALID_INPUT', message: 'Payload inválido.' } }, 400);
    }

    console.error('[api/ai/tasks/deals/analyze] Error:', err);
    return json({ error: { code: 'INTERNAL_ERROR', message: 'Erro ao executar tarefa de IA.' } }, 500);
  }
}
